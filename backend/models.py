import os
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi

# Fetch the MongoDB URI from an environment variable (fallback to hardcoded for development)
uri = os.getenv(
    'MONGODB_URI', 
    "mongodb+srv://oyggpt:Oygminecraft!@hi-lo-backend.misq6.mongodb.net/?retryWrites=true&w=majority&appName=Hi-Lo-Backend"
)

# Initialize MongoDB client
client = MongoClient(uri)

# Define database and collection
db = client['quant_trading_game']
rooms_collection = db['rooms']
