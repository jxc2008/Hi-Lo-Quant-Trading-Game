import os
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi

uri = os.getenv('MONGODB_URI')
if not uri:
    raise ValueError("MONGODB_URI environment variable is required. Set it in your .env or hosting dashboard.")

client = MongoClient(uri)

db = client['quant_trading_game']
rooms_collection = db['rooms']
