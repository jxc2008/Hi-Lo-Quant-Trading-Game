import eventlet
eventlet.monkey_patch(dns=False)

from flask import Flask, request, jsonify
from flask_cors import CORS
from bson.objectid import ObjectId
from models import rooms_collection
from flask_socketio import SocketIO, emit, join_room
import string
import random
import json
import time
import os
import threading
import urllib.request
from game_logic import *
from datetime import datetime

# Constants
ROOM_CODE_LENGTH = 6
DEFAULT_PING_TIMEOUT = 60
DEFAULT_PING_INTERVAL = 25

app = Flask(__name__)
CORS(app, origins=["*"])
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    ping_timeout=DEFAULT_PING_TIMEOUT,
    ping_interval=DEFAULT_PING_INTERVAL,
    transports=['websocket', 'polling']
)

# Global dict mapping (room_id, username) -> socket sid
user_sids = {}

def generate_room_code(length=ROOM_CODE_LENGTH):
    """Generate a random room code."""
    return ''.join(random.choices(string.ascii_uppercase, k=length))

def serialize_game(game):
    """Convert game object to dictionary for JSON serialization (full version for DB/admin)."""
    return {
        "players": [
            {
                "username": player.get_name(),
                "status": player.get_status(),
                "last_active": player.get_last_active(),
                "high_low": player.high_low,
                "contract": {
                    "type_of_action": player.contract.type_of_action if player.contract else None,
                    "number": player.contract.number if player.contract else None,
                },
                "buy_count": player.buy_count,
                "sell_count": player.sell_count,
                "record": player.record,
                "cumulative_pnl": player.cumulative_pnl,
                "round_pnl": player.round_pnl,
            }
            for player in game.players
        ],
        "host": game.get_host(),
        "player_count": game.player_count,
        "current_round": game.current_round,
        "timer": game.timer,
        "dices": [dice.get_value() for dice in game.dices] if game.dices else None,
        "coin": game.coin.get_value() if game.coin else None,
        "current_bid": game.current_bid,
        "current_ask": game.current_ask,
        "bid_player": game.bid_player.get_name() if game.bid_player else None,
        "ask_player": game.ask_player.get_name() if game.ask_player else None,
        "hit_player": game.hit_player.get_name() if game.hit_player else None,
        "lift_player": game.lift_player.get_name() if game.lift_player else None,
        "market_active": game.market_active,
        "round_active": game.round_active,
        "fair_value": game.fair_value,
        "market_paused": game.market_paused,
        "settings": game.settings,
        "round_end_time": game.round_end_time,
        "time_remaining": game.time_remaining,
    }

def serialize_game_for_player(game, username):
    """Convert game object to dictionary with per-player info hiding.

    - For the requesting player: includes their high_low, contract, and record
    - For OTHER players: only username, buy_count, sell_count, cumulative_pnl, round_pnl
    - Game-level: NO dices, coin, or fair_value (secrets)
    """
    players_data = []
    for player in game.players:
        if player.get_name() == username:
            # Full info for the requesting player
            players_data.append({
                "username": player.get_name(),
                "high_low": player.high_low,
                "contract": {
                    "type_of_action": player.contract.type_of_action if player.contract else None,
                    "number": player.contract.number if player.contract else None,
                },
                "buy_count": player.buy_count,
                "sell_count": player.sell_count,
                "record": player.record,
                "cumulative_pnl": player.cumulative_pnl,
                "round_pnl": player.round_pnl,
            })
        else:
            # Limited info for other players
            players_data.append({
                "username": player.get_name(),
                "buy_count": player.buy_count,
                "sell_count": player.sell_count,
                "cumulative_pnl": player.cumulative_pnl,
                "round_pnl": player.round_pnl,
            })

    return {
        "players": players_data,
        "host": game.get_host(),
        "player_count": game.player_count,
        "current_round": game.current_round,
        "timer": game.timer,
        "current_bid": game.current_bid,
        "current_ask": game.current_ask,
        "bid_player": game.bid_player.get_name() if game.bid_player else None,
        "ask_player": game.ask_player.get_name() if game.ask_player else None,
        "market_active": game.market_active,
        "round_active": game.round_active,
        "market_paused": game.market_paused,
        "settings": game.settings,
        "round_end_time": game.round_end_time,
        "time_remaining": game.time_remaining,
    }

def deserialize_game(game_data):
    """Convert dictionary back to game object."""
    game = Game()

    # Restore players
    for player_data in game_data.get("players", []):
        player = Player(
            name=player_data.get("username", "Unknown"),
            status=player_data.get("status", "active"),
            last_active=(
                datetime.fromisoformat(player_data["last_active"])
                if player_data.get("last_active")
                else None
            ),
        )
        player.high_low = player_data.get("high_low")
        player.buy_count = player_data.get("buy_count", 0)
        player.sell_count = player_data.get("sell_count", 0)
        player.record = player_data.get("record", [])
        player.cumulative_pnl = player_data.get("cumulative_pnl", 0)
        player.round_pnl = player_data.get("round_pnl", 0)

        # Restore contract
        contract_data = player_data.get("contract")
        if contract_data and contract_data.get("type_of_action"):
            player.contract = Action(
                type_of_action=contract_data["type_of_action"],
                number=contract_data["number"],
            )

        game.player_join(player)

    # Restore game state
    game.set_host(game_data.get("host", None))
    game.player_count = game_data.get("player_count", 0)
    game.current_round = game_data.get("current_round", 0)
    game.timer = game_data.get("timer", 0)
    game.dices = (
        [Dice() for _ in range(len(game_data["dices"]))] if game_data.get("dices") else None
    )
    if game.dices and game_data.get("dices"):
        for dice, value in zip(game.dices, game_data["dices"]):
            dice.value = value

    game.coin = Coin()
    if game_data.get("coin"):
        game.coin.value = game_data["coin"]

    game.current_bid = game_data.get("current_bid", 0)
    game.current_ask = game_data.get("current_ask", 21)
    game.market_active = game_data.get("market_active", True)
    game.round_active = game_data.get("round_active", False)
    game.fair_value = game_data.get("fair_value", 0)
    game.market_paused = game_data.get("market_paused", False)
    game.settings = game_data.get("settings", {"round_duration": 300, "max_rounds": 5})
    game.round_end_time = game_data.get("round_end_time", 0)
    game.time_remaining = game_data.get("time_remaining", 0)

    # Restore player references
    bid_player_name = game_data.get("bid_player")
    ask_player_name = game_data.get("ask_player")
    hit_player_name = game_data.get("hit_player")
    lift_player_name = game_data.get("lift_player")

    if bid_player_name:
        game.bid_player = next(
            (player for player in game.players if player.name == bid_player_name), None
        )
    if ask_player_name:
        game.ask_player = next(
            (player for player in game.players if player.name == ask_player_name), None
        )
    if hit_player_name:
        game.hit_player = next(
            (player for player in game.players if player.name == hit_player_name), None
        )
    if lift_player_name:
        game.lift_player = next(
            (player for player in game.players if player.name == lift_player_name), None
        )

    return game

def get_admin_for_room(room_id):
    """Get the admin username for a room from DB."""
    room_doc = rooms_collection.find_one({"_id": ObjectId(room_id)})
    if room_doc:
        return room_doc.get("admin")
    return None

def is_request_admin(room_id):
    """Check if the current request's sid belongs to the admin of the room."""
    admin_username = get_admin_for_room(room_id)
    if not admin_username:
        return False
    admin_sid = user_sids.get((room_id, admin_username))
    return admin_sid == request.sid

def emit_per_player(event_name, room_id, game, extra_data=None):
    """Emit per-player serialized data to each player, and full data to admin."""
    room_doc = rooms_collection.find_one({"_id": ObjectId(room_id)})
    admin_username = room_doc.get("admin") if room_doc else None

    for player in game.players:
        sid = user_sids.get((room_id, player.get_name()))
        if sid:
            player_data = serialize_game_for_player(game, player.get_name())
            if extra_data:
                player_data.update(extra_data)
            socketio.emit(event_name, {
                "roomId": room_id,
                "gameData": json.dumps(player_data)
            }, to=sid)

    # Also emit to admin if they exist
    if admin_username:
        admin_sid = user_sids.get((room_id, admin_username))
        if admin_sid:
            admin_data = serialize_game(game)
            admin_data["settings"] = game.settings
            if extra_data:
                admin_data.update(extra_data)
            socketio.emit(event_name, {
                "roomId": room_id,
                "gameData": json.dumps(admin_data),
                "isAdmin": True
            }, to=admin_sid)

@app.route('/create-room', methods=['POST'])
def create_room():
    data = request.json
    name = data.get('room_name')
    password = data.get('password')
    is_private = data.get('isPrivate', False)
    is_admin = data.get('is_admin', False)

    username = data.get("username")

    if rooms_collection.find_one({"name": name}):
        return jsonify({"message": "Room with this name already exists"}), 400

    if len(username) < 3:
        return jsonify({"message": "Username must be at least 3 characters long"}), 400

    room_code = generate_room_code()
    while rooms_collection.find_one({"room_code": room_code}):
        room_code = generate_room_code()

    game = Game()

    if is_admin:
        # Admin mode: do NOT add creator as a player
        game.set_host(username)
        admin_username = username
        num_players = 0
        player_list = []
    else:
        # Normal mode: add creator as a player
        new_player = Player(username)
        new_player.status = "active"
        game.player_join(new_player)
        game.set_host(username)
        admin_username = None
        num_players = 1
        player_list = [username]

    room = {
        "name": name,
        "password": password if password else None,
        "game": serialize_game(game),
        "maxPlayers": 10,
        "isPrivate": is_private,
        "room_code": room_code,
        "admin": admin_username
    }

    try:
        result = rooms_collection.insert_one(room)
        return jsonify({
            "message": "Room created successfully",
            "roomId": str(result.inserted_id),
            "roomCode": room_code,
            "num_players": num_players,
            "player_list": player_list,
            "host_username": username,
            "room_code": room_code,
            "is_admin": is_admin
        }), 201
    except Exception as e:
        return jsonify({"message": str(e)}), 500

@app.route('/rooms', methods=['GET'])
def get_rooms():
    try:
        rooms = list(rooms_collection.find(
            {},
            {
                "_id": 1,
                "name": 1,
                "game.players": 1,
                "game.player_count": 1,
                "maxPlayers": 1,
                "isPrivate": 1,
                "room_code": 1
            }
        ))

        formatted_rooms = []
        for room in rooms:

            game = deserialize_game(room.get("game", {}))

            formatted_room = {
                "_id": str(room["_id"]),
                "name": room["name"],
                "players": [player.to_dict() for player in game.players],  # Serialize players to dict
                "player_count": game.player_count,
                "maxPlayers": room.get('maxPlayers', 10),
                "isPrivate": room.get('isPrivate', False),
                "room_code": room.get('room_code')
            }
            formatted_rooms.append(formatted_room)

        return jsonify(formatted_rooms), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500

@app.route('/join-room', methods=['POST'])
def join_room_route():
    data = request.json
    room_id = data.get('roomId')
    username = data.get('username')
    password = data.get('password')
    room_code = data.get('roomCode')

    try:
        if room_id:
            room = rooms_collection.find_one({"_id": ObjectId(room_id)})
        elif room_code:
            room = rooms_collection.find_one({"room_code": room_code})
        else:
            return jsonify({"message": "Room ID or Room Code is required"}), 400

        if not room:
            return jsonify({"message": "Room not found"}), 404

        if room.get('isPrivate') and room.get('password') != password:
            return jsonify({"message": "Invalid password"}), 401

        if len(username) < 3:
            return jsonify({"message": "Username must be at least 3 characters long"}), 400

        room["game"] = deserialize_game(room.get("game", {}))
        num_players = len(room["game"].players)

        # Check if room is full
        if num_players >= room.get('maxPlayers', 10):
            print('room_full')
            return jsonify({"message": "Room is full"}), 400

        # Check if username is already taken in this room
        username_list = []
        name_taken = False
        for player in room["game"].players:
            if username == player.get_name():
                name_taken = True
                break
            username_list.append(player.get_name())

        # Also check against admin username
        if username == room.get("admin"):
            name_taken = True

        if name_taken:
            return jsonify({"message": "Username taken"}), 400

        username_list.append(username)

        #initiate new player
        new_player = Player(username)
        new_player.status = "active"
        room["game"].player_join(new_player)

        host_username = room["game"].get_host()

        rooms_collection.update_one(
            {"_id": room["_id"]},
            {"$set": {"game": serialize_game(room["game"])}}
        )

        # Notify all clients in the room about the new player
        print(f"Emitting 'player_joined' event to room {room['_id']} with username {username}")
        socketio.emit('player_joined', {
            "roomId": str(room["_id"]),
            "username": username,
            "num_players": num_players + 1,
            "player_list": username_list,
        }, room=str(room["_id"]))

        return jsonify({
            "message": "Room created successfully",
            "roomId": str(room["_id"]),
            "num_players": num_players + 1,
            "player_list": username_list,
            "host_username": host_username,
            "room_code": room_code
        }), 201

    except Exception as e:
        return jsonify({"message": str(e)}), 500


@app.route('/disconnect', methods=['POST'])
def player_disconnect():
    data = json.loads(request.get_data(as_text=True))
    room_id = data.get('roomId')
    username = data.get("username")

    if not room_id or not username:
        return jsonify({"message": "Room ID and Username are required"}), 400

    try:
        room = rooms_collection.find_one({"_id": ObjectId(room_id)})
        if not room:
            return jsonify({"message": "Room not found"}), 404

        game = deserialize_game(room.get("game", {}))

        # Remove the player who left
        game.players = [player for player in game.players if player.name != username]
        game.player_count = len(game.players)

        # Clean up user_sids
        user_sids.pop((room_id, username), None)

        # Check if the leaving player is the host
        if username == game.get_host():
            # Transfer host to the first player who joined after the host (or any active player)
            new_host = None
            if game.players:
                new_host = game.players[0].name  # Assign host to the first player in the list
                game.set_host(new_host)

                # Notify all players about the new host
                socketio.emit('update_host', {
                    "roomId": str(room["_id"]),
                    "newHost": new_host
                }, room=str(room["_id"]))

                # Log the new host in the game log
                socketio.emit('player_left', {
                    "roomId": str(room["_id"]),
                    "username": username,
                    "num_players": game.player_count,
                    "newHost": new_host
                }, room=str(room["_id"]))
            else:
                # If no players are left, delete the room
                rooms_collection.delete_one({"_id": ObjectId(room_id)})
                return jsonify({"message": "Room deleted because no players are left"}), 200

        # Update the room with the new game state
        rooms_collection.update_one(
            {"_id": ObjectId(room_id)},
            {"$set": {"game": serialize_game(game)}}
        )

        # Notify all clients in the room about the player leaving
        socketio.emit('player_left', {
            "roomId": str(room["_id"]),
            "username": username,
            "num_players": game.player_count
        }, room=str(room["_id"]))

        return jsonify({"message": "Player removed"}), 200

    except Exception as e:
        return jsonify({"message": str(e)}), 500

# WebSocket event handlers
@socketio.on('connect')
def handle_connect():
    print('Client connected')

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')
    # Clean up stale sids
    stale_keys = [key for key, sid in user_sids.items() if sid == request.sid]
    for key in stale_keys:
        del user_sids[key]

@socketio.on('join_room')
def handle_join_room(data):
    print("Client joining room")
    room_id = data.get('roomId')
    username = data.get('username')
    if room_id:
        socketio.server.enter_room(sid=request.sid, room=room_id)
        # Track user socket ID
        user_sids[(room_id, username)] = request.sid
        print(f"Client {username} joined room: {room_id} (sid: {request.sid})")
        emit('joined_room', {"roomId": room_id, "username": username}, room=room_id)

@socketio.on('start_game')
def handle_start_game(data):
    room_id = data.get('roomId')
    print(f"Starting game for room: {room_id}")

    room_doc = rooms_collection.find_one({"_id": ObjectId(room_id)})
    if not room_doc:
        print("Room not found.")
        return

    game = deserialize_game(room_doc.get("game", {}))
    game.start_game()

    # Save to DB so state is consistent with what clients receive
    rooms_collection.update_one(
        {"_id": ObjectId(room_id)},
        {"$set": {"game": serialize_game(game)}}
    )

    # Emit per-player data individually
    emit_per_player('start_game', room_id, game)


@socketio.on('start_round')
def start_round_event(data):
    room_id = data.get('roomId')
    print(f"Starting new round for room: {room_id}")

    room_doc = rooms_collection.find_one({"_id": ObjectId(room_id)})
    if not room_doc:
        print("Room not found.")
        return

    game = deserialize_game(room_doc.get("game", {}))
    game.start_new_round()  # Use the revised method to force a new round

    rooms_collection.update_one(
        {"_id": ObjectId(room_id)},
        {"$set": {"game": serialize_game(game)}}
    )

    # Emit per-player data individually
    emit_per_player('start_round', room_id, game)

@socketio.on('make_market')
def handle_make_market(data):
    room_id = data.get("roomId")
    player_name = data.get("playerName")
    action = data.get("action")
    number = data.get("number")

    # Fetch room and game
    room = rooms_collection.find_one({"_id": ObjectId(room_id)})
    if not room:
        emit("market_update", {"success": False, "message": "Room not found"})
        return

    game = deserialize_game(room.get("game", {}))

    # Block trading when paused
    if game.market_paused:
        emit("market_update", {"success": False, "message": "Market is currently paused"})
        return

    # Execute make_the_market
    result = game.make_the_market(player_name, action, number)

    # Update database and notify players
    if result["success"]:
        rooms_collection.update_one(
            {"_id": ObjectId(room_id)},
            {"$set": {"game": serialize_game(game)}}
        )
        socketio.emit("market_update", {
            "success": True,
            "action": action,
            "number": number,
            "currentBid": game.current_bid,
            "currentAsk": game.current_ask,
            "bidPlayer": game.bid_player.name if game.bid_player else None,
            "askPlayer": game.ask_player.name if game.ask_player else None,
            "logMessage": result["message"],  # Include the log message
        }, room=room_id)
        print("runs")
    else:
        emit("market_update", result)
        print("runs!")

@socketio.on('take_market')
def handle_take_market(data):
    room_id = data.get("roomId")
    player_name = data.get("playerName")
    action = data.get("action")

    room = rooms_collection.find_one({"_id": ObjectId(room_id)})
    if not room:
        emit("market_update", {"success": False, "message": "Room not found"})
        return

    game = deserialize_game(room.get("game", {}))

    # Block trading when paused
    if game.market_paused:
        emit("market_update", {"success": False, "message": "Market is currently paused"})
        return

    target_player = game.bid_player if action=="hit" else game.ask_player
    price = game.current_bid if action=="hit" else game.current_ask

    result = game.take_the_market(player_name, action)

    if result["success"]:
         target_name = target_player.name if target_player else None
         rooms_collection.update_one(
            {"_id": ObjectId(room_id)},
            {"$set": {"game": serialize_game(game)}}
         )
         socketio.emit("market_update", {
            "success": True,
            "action": action,
            "price": price,
            "playerName": player_name,
            "bidPlayer": target_name if action=="hit" else None,
            "askPlayer": target_name if action=="lift" else None,
            "logMessage": result["message"],
        }, room=room_id)
    else:
        emit("market_update", result)

@socketio.on('place_ask')
def handle_place_ask(data):
    room_id = data.get('roomId')
    username = data.get('username')
    value = int(data.get('value'))

    room_data = rooms_collection.find_one({"_id": ObjectId(room_id)})
    if not room_data:
        print(f"Room {room_id} not found.")
        emit('error', {'message': 'Room not found.'}, to=request.sid)
        return

    game = deserialize_game(room_data.get("game", {}))

    # Validate the ask
    if value >= game.current_ask:
        emit('error', {'message': 'Ask must be less than the current ask.'}, to=request.sid)
        return

    # Update the ask
    game.current_ask = value
    game.ask_player = next((p for p in game.players if p.name == username), None)

    if game.ask_player:
        game.ask_player.record.append(['ask', value])
    else:
        emit('error', {'message': 'Player not found.'}, to=request.sid)
        return

    # Serialize and save the updated game state
    rooms_collection.update_one(
        {"_id": ObjectId(room_id)},
        {"$set": {"game": serialize_game(game)}}
    )

    # Broadcast the updated market and log to all players
    socketio.emit('update_market', {
        'action': 'ask',
        'value': value,
        'player': username,
        'currentAsk': game.current_ask,
        'logMessage': f"{username} has placed an ask for ${value}."
    }, room=room_id)

    print(f"Player {username} placed an ask of ${value}.")

@socketio.on('end_round')
def handle_end_round(data):
    room_id = data.get('roomId')
    print("Ending round for room:", room_id)

    # Retrieve the room document from the database
    room_doc = rooms_collection.find_one({"_id": ObjectId(room_id)})
    if not room_doc:
        print("Room not found for end_round")
        return

    # Deserialize game state, end the round, and update the room data
    game = deserialize_game(room_doc.get("game", {}))
    fair_value = game.fair_value  # Capture before end_round resets anything
    game.end_round()  # Call the end_round method from game_logic
    rooms_collection.update_one(
        {"_id": ObjectId(room_id)},
        {"$set": {"game": serialize_game(game)}}
    )

    # Emit per-player data with fair_value revealed at end of round
    admin_username = room_doc.get("admin")

    for player in game.players:
        sid = user_sids.get((room_id, player.get_name()))
        if sid:
            player_data = serialize_game_for_player(game, player.get_name())
            player_data["fair_value"] = fair_value
            socketio.emit('end_round', {
                "roomId": room_id,
                "gameData": json.dumps(player_data)
            }, to=sid)

    # Also emit to admin
    if admin_username:
        admin_sid = user_sids.get((room_id, admin_username))
        if admin_sid:
            admin_data = serialize_game(game)
            admin_data["settings"] = game.settings
            admin_data["fair_value"] = fair_value
            socketio.emit('end_round', {
                "roomId": room_id,
                "gameData": json.dumps(admin_data),
                "isAdmin": True
            }, to=admin_sid)

@socketio.on('end_game')
def handle_end_game(data):
    room_id = data.get('roomId')
    message = data.get('message', 'The game has ended.')

    # Notify all players in the room that the game has ended
    socketio.emit('game_ended', {
        "roomId": room_id,
        "message": message
    }, room=room_id)

    # Optionally, you can delete the room from the database here
    rooms_collection.delete_one({"_id": ObjectId(room_id)})

# ---------- Admin socket events ----------

@socketio.on('pause_market')
def handle_pause_market(data):
    room_id = data.get('roomId')
    if not is_request_admin(room_id):
        emit('error', {'message': 'Only the admin can pause the market.'})
        return

    room_doc = rooms_collection.find_one({"_id": ObjectId(room_id)})
    if not room_doc:
        emit('error', {'message': 'Room not found.'})
        return

    game = deserialize_game(room_doc.get("game", {}))
    game.market_paused = True
    remaining = max(0, game.round_end_time - time.time())
    game.time_remaining = remaining

    rooms_collection.update_one(
        {"_id": ObjectId(room_id)},
        {"$set": {"game": serialize_game(game)}}
    )

    socketio.emit('market_paused', {"roomId": room_id, "time_remaining": remaining}, room=room_id)

@socketio.on('resume_market')
def handle_resume_market(data):
    room_id = data.get('roomId')
    if not is_request_admin(room_id):
        emit('error', {'message': 'Only the admin can resume the market.'})
        return

    room_doc = rooms_collection.find_one({"_id": ObjectId(room_id)})
    if not room_doc:
        emit('error', {'message': 'Room not found.'})
        return

    game = deserialize_game(room_doc.get("game", {}))
    game.market_paused = False
    game.round_end_time = time.time() + game.time_remaining

    rooms_collection.update_one(
        {"_id": ObjectId(room_id)},
        {"$set": {"game": serialize_game(game)}}
    )

    socketio.emit('market_resumed', {"roomId": room_id, "time_remaining": game.time_remaining, "round_end_time": game.round_end_time}, room=room_id)

@socketio.on('update_settings')
def handle_update_settings(data):
    room_id = data.get('roomId')
    new_settings = data.get('settings', {})

    if not is_request_admin(room_id):
        emit('error', {'message': 'Only the admin can update settings.'})
        return

    room_doc = rooms_collection.find_one({"_id": ObjectId(room_id)})
    if not room_doc:
        emit('error', {'message': 'Room not found.'})
        return

    game = deserialize_game(room_doc.get("game", {}))

    # Update only provided settings keys
    if 'round_duration' in new_settings:
        game.settings['round_duration'] = new_settings['round_duration']
    if 'max_rounds' in new_settings:
        game.settings['max_rounds'] = new_settings['max_rounds']

    rooms_collection.update_one(
        {"_id": ObjectId(room_id)},
        {"$set": {"game": serialize_game(game)}}
    )

    socketio.emit('settings_updated', {
        "roomId": room_id,
        "settings": game.settings
    }, room=room_id)

@socketio.on('admin_edit_round')
def handle_admin_edit_round(data):
    room_id = data.get('roomId')

    if not is_request_admin(room_id):
        emit('error', {'message': 'Only the admin can edit the round.'})
        return

    room_doc = rooms_collection.find_one({"_id": ObjectId(room_id)})
    if not room_doc:
        emit('error', {'message': 'Room not found.'})
        return

    game = deserialize_game(room_doc.get("game", {}))

    # Update dices if provided
    new_dices = data.get('dices')
    if new_dices is not None and game.dices:
        for i, val in enumerate(new_dices):
            if i < len(game.dices):
                game.dices[i].value = val

    # Update coin if provided
    new_coin = data.get('coin')
    if new_coin is not None:
        game.coin.value = new_coin
        # Update the high_low player's high_low to match the new coin value
        for player in game.players:
            if player.high_low is not None:
                player.high_low = new_coin

    # Update contracts if provided
    new_contracts = data.get('contracts')
    if new_contracts:
        for username, contract_data in new_contracts.items():
            player = next((p for p in game.players if p.name == username), None)
            if player:
                player.contract = Action(
                    type_of_action=contract_data['type'],
                    number=contract_data['number']
                )

    # Recalculate fair_value based on new dice/coin values
    if game.dices and game.coin and game.coin.value:
        dice_values = [d.get_value() for d in game.dices if d.get_value() is not None]
        if dice_values:
            if game.coin.value == "high":
                game.fair_value = max(dice_values)
            else:
                game.fair_value = min(dice_values)

    # Save to DB
    rooms_collection.update_one(
        {"_id": ObjectId(room_id)},
        {"$set": {"game": serialize_game(game)}}
    )

    # Re-emit per-player data to all players (roles may have changed)
    emit_per_player('start_round', room_id, game)

@socketio.on('admin_assign_roles')
def handle_admin_assign_roles(data):
    room_id = data.get('roomId')
    assignments = data.get('assignments', [])

    if not is_request_admin(room_id):
        emit('error', {'message': 'Only the admin can assign roles.'})
        return

    room_doc = rooms_collection.find_one({"_id": ObjectId(room_id)})
    if not room_doc:
        emit('error', {'message': 'Room not found.'})
        return

    game = deserialize_game(room_doc.get("game", {}))
    game.admin_assign_roles(assignments)

    rooms_collection.update_one(
        {"_id": ObjectId(room_id)},
        {"$set": {"game": serialize_game(game)}}
    )

    # Re-emit per-player data
    emit_per_player('start_round', room_id, game)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok"}), 200


# Keep-alive: ping /health every 14 minutes to prevent Render free tier spin-down
def keep_alive(url, interval=840):
    while True:
        time.sleep(interval)
        try:
            urllib.request.urlopen(url)
        except Exception:
            pass

if os.environ.get('RENDER'):
    render_url = os.environ.get('RENDER_EXTERNAL_URL', '')
    if render_url:
        threading.Thread(target=keep_alive, args=(f"{render_url}/health",), daemon=True).start()


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
