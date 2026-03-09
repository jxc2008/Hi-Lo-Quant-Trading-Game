import random
import time
import datetime

# Constants
MIN_PLAYERS = 4
INITIAL_BID = 0
INITIAL_ASK = 21
MIN_VALUE = 1
MAX_VALUE = 20

class Game:
    def __init__(self):
        self.player_count = 0
        self.current_round = 1
        self.timer = 0
        self.dices = None
        self.coin = None
        self.high_low = None
        self.players = []
        self.current_bid = INITIAL_BID
        self.current_ask = INITIAL_ASK
        self.bid_player = None
        self.ask_player = None
        self.hit_player = None
        self.lift_player = None
        self.market_active = True
        self.round_active = False
        self.fair_value = 0
        self.host = None

    def set_host(self, host):
        """Set the game host."""
        self.host = host
    
    def get_host(self):
        """Get the current game host."""
        return self.host
    
    def player_join(self, player):
        """Add a player to the game."""
        self.players.append(player)
        self.player_count += 1
    
    def player_leave(self, player):
        """Remove a player from the game."""
        self.players.remove(player)
        self.player_count -= 1
    
    def start_game(self):
        """Initialize and start the game."""
        if not self.market_active:
            print("The market is currently closed. Cannot start a new round.")
            return
        
        if self.round_active:
            print("A round is already running. Cannot start a new round until the current one ends.")
            return
        
        self.round_active = True  # Mark the round as active
        self.player_count = len(self.players)

        #initialize the game
        self.timer = time.time() #current time, will continuously update to check if elapsed time from this time is 5 minutes
        
        self.market_active = True #opens market

        #more than 8 players will be 3 dice and less than 8 is 2 dice
        #initialize dice to a list of 2 or 3 dice
        self.dices = [Dice() for i in range(2 if len(self.players) < 8 else 3)]

        #initialize if the round is high or low
        self.coin = Coin()
        self.start_round()
        # while self.market_active:
        #     current_time = time.time()
            
            #Check if 5 minutes have passed
        #     if current_time - self.timer > 300:  # 300 seconds = 5 minutes
        #         self.end_round()
        #         break  # End the current round and exit the loop
            
            # Placeholder for other game logic
            # self.prompt_user()
    
    def start_round(self):
        
        self.current_bid = 0
        self.current_ask = 21
        
        
        for player in self.players:
            player.contract = None
            player.high_low = None
            # Optionally reset other per-round attributes if needed
            player.record = []
            
        """
        Starts a new round, assigns contracts and high/low player.
        """
        print("\nStarting a new round!")
        
        high_low_player = random.choice(self.players)
        high_low_player.high_low = self.coin.flip()
        print(f"{high_low_player.name} is the High/Low player with {high_low_player.high_low}.")
        
        # Create eligible players list excluding the high_low_player
        eligible_players = [player for player in self.players if player != high_low_player]
        
        # Debug
        if len(eligible_players) < len(self.dices):
            print("Not enough eligible players to assign each die uniquely.")
            print(f"Eligible Players: {len(eligible_players)}, Dice: {len(self.dices)}")
            return
        
        # Roll the dice
        dice_rolls = [dice.roll() for dice in self.dices]
        dice_players = random.sample(eligible_players, len(dice_rolls))
        
        # Assign the dice rolls to the players
        for i, dice_player in enumerate(dice_players):
            dice_player.record.append(["dice_roll", dice_rolls[i]])
            print(f"{dice_player.name} received a dice roll of ${dice_rolls[i]}")
        
        # Determine the fair_value based on High/Low outcome
        if high_low_player.high_low == "high":
            # High: Set fair_value to the highest dice roll
            highest_roll = max(dice_rolls)
            self.fair_value = highest_roll
            print(f"Fair Value is set to the highest dice roll: ${self.fair_value}.")
        else:
            # Low: Set fair_value to the lowest dice roll
            lowest_roll = min(dice_rolls)
            self.fair_value = lowest_roll
            print(f"Fair Value is set to the lowest dice roll: ${self.fair_value}.")
            
        # Assign contracts to players not involved in dice rolls and not the high_low_player
        for player in self.players:
            if player not in dice_players and player != high_low_player:
                action = random.choice(["long", "short"])
                contract_number = random.randint(1, 5)
                player.contract = Action(action, contract_number)  # Using Action object
                print(f"{player.name} assigned {player.contract.type_of_action.upper()} contract with number {player.contract.number}.")
        
        # Debug: Verify contracts
        print("\nContract Assignment Debug:")
        for player in self.players:
            if player.contract:
                print(f"{player.name}: Contract - {player.contract.type_of_action.upper()}, Number - {player.contract.number}")
            else:
                print(f"{player.name}: No contract assigned.")


        
    #tracker function
    #function will receive action and player name and it will print it
    #def tracker(self, player_name, player_action_count):
        #print("Player " + player + "has " + action)
    def start_new_round(self):
        # Start a new round without user prompt, incrementing round and resetting roles/contracts
        self.round_active = False
        self.start_game()
    
    def end_round(self):
        """
        Ends the current round, compares contracts, applies penalties, calculates P/L, and resets necessary variables.
        """
        print("\nYour 5 minutes are up! Ending the current round.")
        print(f"Fair Value for this round: ${self.fair_value}")

        for player in self.players:
            total_pl = 0
            print(f"\nProcessing player: {player.name}")

            # Handle Contract Fulfillment
            if player.contract and player.contract.type_of_action in ["long", "short"]:
                action_type = player.contract.type_of_action
                required_trades = player.contract.number
                print(f"{player.name} has a {action_type.upper()} contract requiring {required_trades} trades.")

                if action_type == "long":
                    if player.buy_count >= required_trades:
                        print(f"{player.name} fulfilled their LONG contract requirement! ✅")
                    else:
                        print(f"{player.name} did NOT fulfill their LONG contract requirement. ❌ Cumulative P/L decreased by $100.")
                        total_pl -= 100

                elif action_type == "short":
                    if player.sell_count >= required_trades:
                        print(f"{player.name} fulfilled their SHORT contract requirement! ✅")
                    else:
                        print(f"{player.name} did NOT fulfill their SHORT contract requirement. ❌ Cumulative P/L decreased by $100.")
                        total_pl -= 100

            # Calculate Profit/Loss based on Actions
            for action_entry in player.record:
                # Each action_entry is expected to be a list: [action, price]
                if not isinstance(action_entry, list) or len(action_entry) != 2:
                    print(f"Invalid action entry for player {player.name}: {action_entry}")
                    continue

                action, price = action_entry
                action = action.lower()

                if action == "long":
                    pl = self.fair_value - price
                    print(f"Player {player.name} LONG at ${price}: P/L = ${self.fair_value} - ${price} = ${pl}")
                elif action == "short":
                    pl = price - self.fair_value
                    print(f"Player {player.name} SHORT at ${price}: P/L = ${price} - ${self.fair_value} = ${pl}")
                else:
                    continue

                total_pl += pl

            # Update Player's cumulative_pnl
            player.cumulative_pnl += total_pl
            player.round_pnl = total_pl
            print(f"Player {player.name} round P/L for this round: ${total_pl}")
            print(f"Player {player.name} new cumulative P/L: ${player.cumulative_pnl}")

            # Reset Player's Records for Next Round
            player.record = []
            player.buy_count = 0
            player.sell_count = 0

        # Reset Market Variables for Next Round
        self.current_round += 1
        self.current_bid = 0
        self.current_ask = 21
        self.bid_player = None
        self.ask_player = None
        self.hit_player = None
        self.lift_player = None
        self.timer = time.time()  # Reset the timer for the next round
        self.round_active = False  # Stop the current round

        print("\n--- Round Ended Successfully ---\n")


    def make_the_market(self, player_name, action, number):
        # Step 1: Check if the player is in the player names array
        player = next((player for player in self.players if player.name.lower() == player_name.lower()), None)

        if player is None:
            return {"success": False, "message": "Player not found"}

        # Step 2: Check if the action is valid ("bid" or "ask")
        if action not in ["bid", "ask"]:
            return {"success": False, "message": "Invalid action"}

        # Step 3: Check if the number is valid
        if not isinstance(number, int) or not (1 <= number <= 20):
            return {"success": False, "message": "Invalid number"}

        log_message = ""
        if action == "bid":
            if number <= self.current_bid:
                return {"success": False, "message": "Bid must be greater than the current bid"}
            self.current_bid = number
            self.bid_player = player
            player.record.append(["bid", number])
            log_message = f"{player_name} has placed a bid for ${number}"
        elif action == "ask":
            if number >= self.current_ask:
                return {"success": False, "message": "Ask must be less than the current ask"}
            self.current_ask = number
            self.ask_player = player
            player.record.append(["ask", number])
            log_message = f"{player_name} has placed an ask for ${number}"

        return {"success": True, "message": log_message}


        
    def take_the_market(self, player_name, action):
        player = next((p for p in self.players if p.name.lower() == player_name.lower()), None)
        if not player:
            return {"success": False, "message": "Player not found."}

        if action == "hit":
            if self.current_bid == 0:
                return {"success": False, "message": "No valid bid available to hit."}
            if not self.bid_player:
                return {"success": False, "message": "Bid player not found."}
            # Disallow self-hit
            if player_name.lower() == self.bid_player.name.lower():
                return {"success": False, "message": "You cannot hit your own bid."}

            # Execute trade for hit
            self.hit_player = player
            self.hit_player.sell_count += 1
            self.bid_player.buy_count += 1
            self.hit_player.record.append(["short", self.current_bid])
            self.bid_player.record.append(["long", self.current_bid])

            message = f"{player_name} has hit the bid! Sold to {self.bid_player.name} for ${self.current_bid}."
            self.current_bid = 0
            self.bid_player = None
            self.hit_player = None

            return {"success": True, "message": message}

        elif action == "lift":
            if self.current_ask == 21:
                return {"success": False, "message": "No valid ask available to lift."}
            if not self.ask_player:
                return {"success": False, "message": "Ask player not found."}
            # Disallow self-lift
            if player_name.lower() == self.ask_player.name.lower():
                return {"success": False, "message": "You cannot lift your own ask."}

            # Execute trade for lift
            self.lift_player = player
            self.lift_player.buy_count += 1
            self.ask_player.sell_count += 1
            self.lift_player.record.append(["long", self.current_ask])
            self.ask_player.record.append(["short", self.current_ask])

            message = f"{player_name} has lifted the ask! Bought from {self.ask_player.name} for ${self.current_ask}."
            self.current_ask = 21
            self.ask_player = None
            self.lift_player = None

            return {"success": True, "message": message}

        return {"success": False, "message": "Invalid action. Use 'hit' or 'lift'."}





        
    def prompt_user(self):
        if not self.market_active:
            print("The market is currently closed. Please wait for the next round.")
            return
        
        if not self.round_active:
            print("No active round. Please start a new round to interact with the market.")
            return
    
        print("Enter your command: Use 'make' to post a bid/ask, or 'take' to hit the bid/lift the ask.")
        input_text = input().strip()
        
        if not input_text:
            print("No input provided. Please try again.")
            return
        
        # Extract the first word
        first_word = input_text.split()[0].lower()
        
        if first_word in ["make"]:
            # Call make_the_market if the first word is 'make'
            self.make_the_market()
        elif first_word in ["take"]:
            # Call take_the_market if the first word is 'take'
            self.take_the_market()
        else:
            print("Invalid input. Please start with 'make' or 'take'.")
            
    def get_buy_count(self, player_name):
        """
        Returns the buy_count of a player given their name.
        """
        # Search for the player by name
        player = next((p for p in self.players if p.name.lower() == player_name.lower()), None)
        
        if player:
            return player.buy_count
        else:
            print(f"Player '{player_name}' not found.")
            return None
    
    #add player function
    def add_player(self, name):
        new_player = Player(name)
        self.players.append(new_player)
        self.player_count += 1
        print(f"Player {name} has joined the game.")
    
    #so mongoDB can add a new player
    def to_dict(self):
        return { "players": [player.to_dict() for player in self.players] }

class Coin:
    def __init__(self):
        self.value = None

    #flip the coin if its heads its "high" if its tails its "low"
    def flip(self):
        self.value = random.choice(["high", "low"])
        return self.value

    def get_value(self):
        return self.value


class Dice:
    def __init__(self):
        self.value = None

    def roll(self):
        self.value = random.randint(1,20)
        return self.value

    def get_value(self):
        return self.value


class Player:
    def __init__(self, name, status="active", last_active=None):
        self.name = name
        self.high_low = None
        self.price = None
        self.contract = None
        self.buy_count = 0
        self.sell_count = 0
        self.record = [] #list of action objects
        self.cumulative_pnl = 0
        self.round_pnl = 0
        self.status = None
        self.last_active = last_active or datetime.datetime.now()
        
    def get_name(self):
        return self.name
    
    def get_status(self):
        return self.status
    
    def get_last_active(self):
        return self.last_active.isoformat() if self.last_active else None
    
    def get_sell_count(self):
        return self.sell_count
    
    def to_dict(self):
        return {
            "username": self.name,
            "status": self.status,
            "last_active": self.last_active.isoformat() if self.last_active else None
        }

class Action:
    def __init__(self, type_of_action, number):
        #long, short
        self.type_of_action = type_of_action #long, short
        #price of the action
        self.number = number
    
    def get_action(self):
        return self.type_of_action
    
    def get_price(self):
        return self.number
    
    def set_action(self, action):
        self.type_of_action = action
    
    def set_price(self, price):
        self.number = price
        