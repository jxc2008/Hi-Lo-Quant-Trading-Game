from flask import Flask, request, jsonify
from flask_cors import CORS
from bson.objectid import ObjectId
from models import rooms_collection
from flask_socketio import SocketIO, emit
import string
import random
import json
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
    transports=['websocket']
)

def generate_room_code(length=ROOM_CODE_LENGTH):
    """Generate a random room code."""
    return ''.join(random.choices(string.ascii_uppercase, k=length))

def serialize_game(game):
    """Convert game object to dictionary for JSON serialization."""
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
        if contract_data and contract_data["type_of_action"]:
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

@app.route('/create-room', methods=['POST'])
def create_room():
    data = request.json
    name = data.get('room_name')
    password = data.get('password')
    is_private = data.get('isPrivate', False)

    username = data.get("username")

    if rooms_collection.find_one({"name": name}):
        return jsonify({"message": "Room with this name already exists"}), 400

    if len(username) < 3:
        return jsonify({"message": "Username must be at least 3 characters long"}), 400
    
    room_code = generate_room_code()
    while rooms_collection.find_one({"room_code": room_code}):
        room_code = generate_room_code()
    
    game = Game()

    #initiate first player
    new_player = Player(username)
    new_player.status = "active"
    game.player_join(new_player)

    game.set_host(username)

    room = {
        "name": name,
        "password": password if password else None,
        "game": serialize_game(game),
        "maxPlayers": 10,
        "isPrivate": is_private,
        "room_code": room_code
    }

    try:
        result = rooms_collection.insert_one(room)
        return jsonify({
            "message": "Room created successfully",
            "roomId": str(result.inserted_id),
            "roomCode": room_code,
            "num_players": 1,
            "player_list": [username],
            "host_username": username,
            "room_code": room_code
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
def join_room():
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

@socketio.on('join_room')
def handle_join_room(data):
    print("Client joining room")
    room_id = data.get('roomId')
    username = data.get('username')
    if room_id:
        socketio.server.enter_room(sid=request.sid, room=room_id)
        print(f"Client {username} joined room: {room_id}")
        emit('joined_room', {"roomId": room_id, "username": username}, room=room_id)

@socketio.on('start_game')
def handle_start_game(data):
    room_id = data.get('roomId')
    print(f"Starting game for room: {room_id}")

    game = deserialize_game(rooms_collection.find_one({"_id": ObjectId(room_id)}).get("game", {}))
    game.start_game()

    game_data = serialize_game(game)

    # Emit the start_game event to all clients in the room
    socketio.emit('start_game', {
        "roomId": room_id,
        "gameData": json.dumps(game_data)  # Ensure game_data is a JSON string
    }, room=room_id)
    

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

    game_data = serialize_game(game)
    socketio.emit('start_round', {
        "roomId": room_id,
        "gameData": json.dumps(game_data)
    }, room=room_id)
    
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
def handle_take_market(data):  # update!
    room_id = data.get("roomId")  # update!
    player_name = data.get("playerName")  # update!
    action = data.get("action")  # update!

    room = rooms_collection.find_one({"_id": ObjectId(room_id)})  # update!
    if not room:  # update!
        emit("market_update", {"success": False, "message": "Room not found"})  # update!
        return  # update!

    game = deserialize_game(room.get("game", {}))  # update!
    target_player = game.bid_player if action=="hit" else game.ask_player  # update!
    price = game.current_bid if action=="hit" else game.current_ask  # update!

    result = game.take_the_market(player_name, action)  # update!

    if result["success"]:  # update!
         target_name = target_player.name if target_player else None  # update!
         rooms_collection.update_one(  # update!
            {"_id": ObjectId(room_id)},
            {"$set": {"game": serialize_game(game)}}
         )  # update!
         socketio.emit("market_update", {  # update!
            "success": True,
            "action": action,
            "price": price,
            "playerName": player_name,
            "bidPlayer": target_name if action=="hit" else None,
            "askPlayer": target_name if action=="lift" else None,
            "logMessage": result["message"],
        }, room=room_id)  # update!
    else:
        emit("market_update", result)  # update!

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
    game.end_round()  # Call the end_round method from game_logic
    rooms_collection.update_one(
        {"_id": ObjectId(room_id)},
        {"$set": {"game": serialize_game(game)}}
    )
    
    # Emit the end_round event to all players in the room
    game_data = serialize_game(game)
    socketio.emit('end_round', {
        "roomId": room_id,
        "gameData": json.dumps(game_data)
    }, room=room_id)  # update! Emit to all players in the room

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

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
