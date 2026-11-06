/* Copyright (c) 2026 Marina Bay's Cafe. All rights reserved. */
/* Starting menu for Marina Bay's Cafe.
   This file is only the starting point. Once you change the menu inside the app (Menu editor),
   the app keeps its own copy on that device and uses that instead.

   categories   : the sections of the menu. "sizes" is the list of size names offered when you add a new item.
   items        : each item has one or more "options" (a size or version, with its price).
                  best = best seller, soldOut = hidden from ordering, check = price still needs checking.
   lid          : which lid the section uses: "flat", "dome" (round, for frappe) or "none". Hot drinks always use the black lid.
   addonGroups  : the "Ship Upgrades". "cats" says which categories can use that group.
   To add or remove things by hand, copy one line and change it. Keep every id unique. */
window.MB_DEFAULT_MENU = {
  categories: [
    {"id": "sailors-delight", "name": "Sailor's Delight", "group": "Drinks", "note": "Must try!", "sizes": ["16 oz iced", "22 oz iced"], "lid": "flat"},
    {"id": "captains-brew", "name": "Captain's Brew", "group": "Drinks", "note": "Espresso & Coffee", "sizes": ["16 oz iced", "22 oz iced", "12 oz hot"], "lid": "flat"},
    {"id": "safe-harbour", "name": "Safe Harbour", "group": "Drinks", "note": "Non-Coffee & Milk", "sizes": ["16 oz iced", "22 oz iced", "12 oz hot"], "lid": "flat"},
    {"id": "green-lagoon", "name": "Green Lagoon", "group": "Drinks", "note": "Matcha", "sizes": ["16 oz iced", "22 oz iced", "12 oz hot"], "lid": "flat"},
    {"id": "bay-breeze", "name": "Bay Breeze Blends", "group": "Drinks", "note": "Ice-Blended/Frappe", "sizes": ["16 oz iced", "22 oz iced"], "lid": "dome"},
    {"id": "shoreline-sips", "name": "Shoreline Sips", "group": "Drinks", "note": "Carbonated", "sizes": ["16 oz iced", "22 oz iced"], "lid": "flat"},
    {"id": "pearls-legends", "name": "Ocean Pearls: Legends of the Deep", "group": "Drinks", "note": "Flavoured Milk Tea", "sizes": ["12 oz iced", "16 oz iced", "22 oz iced"], "lid": "flat"},
    {"id": "pearls-classics", "name": "Ocean Pearls: Coastal Classics", "group": "Drinks", "note": "Classic Milk Tea", "sizes": ["12 oz iced", "16 oz iced", "22 oz iced"], "lid": "flat"},
    {"id": "island-coolers", "name": "Island Coolers", "group": "Drinks", "note": "Fruit Tea", "sizes": ["16 oz iced", "22 oz iced"], "lid": "flat"},
    {"id": "main-deck", "name": "Main Deck", "group": "Food", "note": "Pasta & Mains", "sizes": ["Regular"], "lid": "none"},
    {"id": "wings-of-the-sea", "name": "Wings of the Sea", "group": "Food", "note": "Chicken Wings Platter", "sizes": ["Regular"], "lid": "none"},
    {"id": "pier-bites", "name": "Pier Bites", "group": "Food", "note": "Pika-Pika | Good for Sharing", "sizes": ["Regular"], "lid": "none"},
    {"id": "portside-plates", "name": "Portside Plates", "group": "Food", "note": "Rice Meals & Bowls", "sizes": ["Regular"], "lid": "none"},
  ],
  items: [
    // Sailor's Delight
    {"id": "tiramisu-tides", "cat": "sailors-delight", "name": "Tiramisu Tides", "desc": "Tiramisu Latte", "best": true, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 180}, {"label": "22 oz iced", "price": 200}]},
    {"id": "sunken-island", "cat": "sailors-delight", "name": "Sunken Island", "desc": "Affogato Latte", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 135}, {"label": "22 oz iced", "price": 160}]},
    {"id": "whipped-horizon", "cat": "sailors-delight", "name": "Whipped Horizon", "desc": "Dalgona Latte", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 115}, {"label": "22 oz iced", "price": 140}]},
    // Captain's Brew
    {"id": "flagship", "cat": "captains-brew", "name": "Flagship", "desc": "Cafe Latte", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 115}, {"label": "22 oz iced", "price": 130}, {"label": "12 oz hot", "price": 120}]},
    {"id": "black-sea", "cat": "captains-brew", "name": "Black Sea", "desc": "Americano", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 90}, {"label": "22 oz iced", "price": 110}, {"label": "12 oz hot", "price": 90}]},
    {"id": "the-galleon", "cat": "captains-brew", "name": "The Galleon", "desc": "Spanish Latte", "best": true, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 120}, {"label": "22 oz iced", "price": 140}, {"label": "12 oz hot", "price": 130}]},
    {"id": "ivory-coast", "cat": "captains-brew", "name": "Ivory Coast", "desc": "White Chocolate Latte", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 125}, {"label": "22 oz iced", "price": 140}, {"label": "12 oz hot", "price": 135}]},
    {"id": "compass-caramel", "cat": "captains-brew", "name": "Compass Caramel", "desc": "Caramel Macchiato", "best": true, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 140}, {"label": "22 oz iced", "price": 160}, {"label": "12 oz hot", "price": 150}]},
    {"id": "stormy-bay", "cat": "captains-brew", "name": "Stormy Bay", "desc": "Dirty Matcha", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 160}, {"label": "22 oz iced", "price": 175}, {"label": "12 oz hot", "price": 165}]},
    {"id": "black-reef", "cat": "captains-brew", "name": "Black Reef", "desc": "Coffee Jelly Latte", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 130}, {"label": "22 oz iced", "price": 150}]},
    {"id": "sandbar", "cat": "captains-brew", "name": "Sandbar", "desc": "Biscoff Latte", "best": false, "soldOut": false, "check": true, "note": "", "options": [{"label": "16 oz iced", "price": 170}]},
    {"id": "orca", "cat": "captains-brew", "name": "Orca", "desc": "Oreo Latte", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 130}, {"label": "22 oz iced", "price": 150}]},
    // Safe Harbour
    {"id": "berry-cove", "cat": "safe-harbour", "name": "Berry Cove", "desc": "Choco-Berry Milk", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 125}, {"label": "22 oz iced", "price": 140}, {"label": "12 oz hot", "price": 120}]},
    {"id": "cocoa-drift", "cat": "safe-harbour", "name": "Cocoa Drift", "desc": "Cocoa Caramel Milk", "best": true, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 140}, {"label": "22 oz iced", "price": 160}, {"label": "12 oz hot", "price": 130}]},
    {"id": "mermaid-milk", "cat": "safe-harbour", "name": "Mermaid Milk", "desc": "Strawberry Milk", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 130}, {"label": "22 oz iced", "price": 150}]},
    {"id": "treasure-cove", "cat": "safe-harbour", "name": "Treasure Cove", "desc": "Biscoff Milk", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 160}]},
    {"id": "puffin", "cat": "safe-harbour", "name": "Puffin", "desc": "Oreo Milk", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 120}, {"label": "22 oz iced", "price": 140}]},
    // Green Lagoon
    {"id": "green-island", "cat": "green-lagoon", "name": "Green Island", "desc": "Matcha Latte", "best": true, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 140}, {"label": "22 oz iced", "price": 160}, {"label": "12 oz hot", "price": 160}]},
    {"id": "coral-reef", "cat": "green-lagoon", "name": "Coral Reef", "desc": "Strawberry Matcha Latte", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 160}, {"label": "22 oz iced", "price": 180}]},
    {"id": "azure-reef", "cat": "green-lagoon", "name": "Azure Reef", "desc": "Blue Cloud Matcha Latte", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 145}, {"label": "22 oz iced", "price": 175}]},
    {"id": "salty-mariner", "cat": "green-lagoon", "name": "Salty Mariner", "desc": "Seasalt Matcha Latte", "best": false, "soldOut": false, "check": true, "note": "", "options": [{"label": "16 oz iced", "price": 150}, {"label": "22 oz iced", "price": 170}]},
    {"id": "jade-island", "cat": "green-lagoon", "name": "Jade Island", "desc": "Biscoff Matcha Latte", "best": false, "soldOut": false, "check": true, "note": "", "options": [{"label": "16 oz iced", "price": 180}]},
    // Bay Breeze Blends
    {"id": "night-watch", "cat": "bay-breeze", "name": "Night Watch", "desc": "Chocolate Chip Espresso", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 170}, {"label": "22 oz iced", "price": 190}]},
    {"id": "sea-foam", "cat": "bay-breeze", "name": "Sea Foam", "desc": "White Chocolate", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 160}, {"label": "22 oz iced", "price": 180}]},
    {"id": "emerald-coast", "cat": "bay-breeze", "name": "Emerald Coast", "desc": "Matcha", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 150}, {"label": "22 oz iced", "price": 165}]},
    {"id": "mudslide", "cat": "bay-breeze", "name": "Mudslide", "desc": "Chocolate Chip", "best": true, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 150}, {"label": "22 oz iced", "price": 165}]},
    {"id": "golden-sands", "cat": "bay-breeze", "name": "Golden Sands", "desc": "Caramel", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 145}, {"label": "22 oz iced", "price": 165}]},
    {"id": "pink-sunset", "cat": "bay-breeze", "name": "Pink Sunset", "desc": "Strawberry", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 140}, {"label": "22 oz iced", "price": 160}]},
    {"id": "black-sands", "cat": "bay-breeze", "name": "Black Sands", "desc": "Coffee Jelly", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 150}, {"label": "22 oz iced", "price": 170}]},
    {"id": "cookies-crew", "cat": "bay-breeze", "name": "Cookies & Crew", "desc": "Oreo", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 170}, {"label": "22 oz iced", "price": 180}]},
    {"id": "sandstorm", "cat": "bay-breeze", "name": "Sandstorm", "desc": "Biscoff", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 180}]},
    // Shoreline Sips
    {"id": "pacific-blue", "cat": "shoreline-sips", "name": "Pacific Blue", "desc": "Blueberry Soda", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 100}, {"label": "22 oz iced", "price": 115}]},
    {"id": "red-sky", "cat": "shoreline-sips", "name": "Red Sky", "desc": "Raspberry Lemonade", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 100}, {"label": "22 oz iced", "price": 115}]},
    {"id": "sunshine-coast", "cat": "shoreline-sips", "name": "Sunshine Coast", "desc": "Lychee Yuzu", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 115}, {"label": "22 oz iced", "price": 130}]},
    {"id": "crimson-tide", "cat": "shoreline-sips", "name": "Crimson Tide", "desc": "Strawberry Ade", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 115}, {"label": "22 oz iced", "price": 130}]},
    {"id": "sea-glass", "cat": "shoreline-sips", "name": "Sea Glass", "desc": "Baja Blast", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 90}, {"label": "22 oz iced", "price": 100}]},
    {"id": "maroon-pop", "cat": "shoreline-sips", "name": "Maroon Pop", "desc": "Cherry Cola", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 100}, {"label": "22 oz iced", "price": 115}]},
    // Ocean Pearls: Legends of the Deep
    {"id": "bakunawa", "cat": "pearls-legends", "name": "Bakunawa", "desc": "Chocolate", "best": true, "soldOut": false, "check": false, "note": "", "options": [{"label": "12 oz iced", "price": 45}, {"label": "16 oz iced", "price": 60}, {"label": "22 oz iced", "price": 80}]},
    {"id": "butanding", "cat": "pearls-legends", "name": "Butanding", "desc": "Cookies & Cream", "best": true, "soldOut": false, "check": false, "note": "", "options": [{"label": "12 oz iced", "price": 45}, {"label": "16 oz iced", "price": 60}, {"label": "22 oz iced", "price": 80}]},
    {"id": "sirena", "cat": "pearls-legends", "name": "Sirena", "desc": "Strawberry", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "12 oz iced", "price": 45}, {"label": "16 oz iced", "price": 60}, {"label": "22 oz iced", "price": 80}]},
    {"id": "engkanto", "cat": "pearls-legends", "name": "Engkanto", "desc": "Matcha", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "12 oz iced", "price": 60}, {"label": "16 oz iced", "price": 75}, {"label": "22 oz iced", "price": 100}]},
    {"id": "diwata", "cat": "pearls-legends", "name": "Diwata", "desc": "Taro", "best": false, "soldOut": false, "check": true, "note": "", "options": [{"label": "12 oz iced", "price": 60}, {"label": "16 oz iced", "price": 75}, {"label": "22 oz iced", "price": 100}]},
    {"id": "magayon", "cat": "pearls-legends", "name": "Magayon", "desc": "Red Velvet", "best": false, "soldOut": false, "check": true, "note": "", "options": [{"label": "16 oz iced", "price": 75}, {"label": "22 oz iced", "price": 100}]},
    // Ocean Pearls: Coastal Classics
    {"id": "amihan", "cat": "pearls-classics", "name": "Amihan", "desc": "Hokkaido", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "12 oz iced", "price": 45}, {"label": "16 oz iced", "price": 60}, {"label": "22 oz iced", "price": 80}]},
    {"id": "balangay", "cat": "pearls-classics", "name": "Balangay", "desc": "Brown Sugar", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "12 oz iced", "price": 45}, {"label": "16 oz iced", "price": 60}, {"label": "22 oz iced", "price": 80}]},
    {"id": "habagat", "cat": "pearls-classics", "name": "Habagat", "desc": "Okinawa", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "12 oz iced", "price": 45}, {"label": "16 oz iced", "price": 60}, {"label": "22 oz iced", "price": 80}]},
    {"id": "takipsilim", "cat": "pearls-classics", "name": "Takipsilim", "desc": "Wintermelon", "best": true, "soldOut": false, "check": false, "note": "", "options": [{"label": "12 oz iced", "price": 45}, {"label": "16 oz iced", "price": 60}, {"label": "22 oz iced", "price": 80}]},
    // Island Coolers
    {"id": "apolaki", "cat": "island-coolers", "name": "Apolaki", "desc": "Mango", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 60}, {"label": "22 oz iced", "price": 75}]},
    {"id": "hanan", "cat": "island-coolers", "name": "Hanan", "desc": "Melon", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 60}, {"label": "22 oz iced", "price": 75}]},
    {"id": "makiling", "cat": "island-coolers", "name": "Makiling", "desc": "Green Apple", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 60}, {"label": "22 oz iced", "price": 75}]},
    {"id": "tala", "cat": "island-coolers", "name": "Tala", "desc": "Lemon", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "16 oz iced", "price": 60}, {"label": "22 oz iced", "price": 75}]},
    // Main Deck
    {"id": "chef-s-signature-pasta", "cat": "main-deck", "name": "Chef's Signature Pasta", "desc": "Italian Spaghetti Meatballs", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "Regular", "price": 180}]},
    {"id": "chicken-alfredo-pasta", "cat": "main-deck", "name": "Chicken Alfredo Pasta", "desc": "Creamy White Sauce Pasta", "best": true, "soldOut": false, "check": false, "note": "", "options": [{"label": "Regular", "price": 150}]},
    {"id": "tuna-pesto-pasta", "cat": "main-deck", "name": "Tuna Pesto Pasta", "desc": "Spicy Green Sauce Pasta", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "Regular", "price": 170}]},
    {"id": "mac-cheese", "cat": "main-deck", "name": "Mac & Cheese", "desc": "Yellow Sauce Pasta", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "Regular", "price": 155}]},
    // Wings of the Sea
    {"id": "original-platter", "cat": "wings-of-the-sea", "name": "Original Platter", "desc": "Classic Fried | 3 pcs", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "Regular", "price": 175}]},
    {"id": "soy-garlic-platter", "cat": "wings-of-the-sea", "name": "Soy Garlic Platter", "desc": "Sweet & Savoury | 3 pcs", "best": true, "soldOut": false, "check": false, "note": "", "options": [{"label": "Regular", "price": 185}]},
    {"id": "spicy-buffalo-platter", "cat": "wings-of-the-sea", "name": "Spicy Buffalo Platter", "desc": "Spicy & Umami | 3 pcs", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "Regular", "price": 195}]},
    // Pier Bites
    {"id": "fries", "cat": "pier-bites", "name": "Fries", "desc": "Pika-pika, good for sharing", "best": false, "soldOut": false, "check": true, "note": "", "options": [{"label": "Original | Salted", "price": 130}, {"label": "Flavoured (Cheese, BBQ, Sour Cream)", "price": 120}]},
    {"id": "beef-nachos", "cat": "pier-bites", "name": "Beef Nachos", "desc": "With bolognese, cheese sauce, tomatoes, lettuce, bell peppers, & parmesan", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "Solo (1 voyager)", "price": 130}, {"label": "Duo (2-3 voyagers)", "price": 160}, {"label": "Group (4-5 voyagers)", "price": 220}]},
    {"id": "cheesy-chicken-shanghai", "cat": "pier-bites", "name": "Cheesy Chicken Shanghai", "desc": "", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "Regular", "price": 135}]},
    // Portside Plates
    {"id": "chicken-wings", "cat": "portside-plates", "name": "Chicken Wings", "desc": "Choose 1 wing flavour: original, soy garlic, spicy buffalo", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "Regular", "price": 150}]},
    {"id": "chicken-tenders", "cat": "portside-plates", "name": "Chicken Tenders", "desc": "Paired with garlic mayo dip", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "Regular", "price": 175}]},
    {"id": "chicken-tenders-ala-king", "cat": "portside-plates", "name": "Chicken Tenders Ala King", "desc": "Smothered with MBC's in-house ala king sauce", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "Regular", "price": 190}]},
    {"id": "meatballs-with-mushroom-and-gravy", "cat": "portside-plates", "name": "Meatballs with Mushroom and Gravy", "desc": "Beef meatballs paired with MBC's in-house gravy", "best": false, "soldOut": false, "check": false, "note": "", "options": [{"label": "Regular", "price": 160}]},
  ],
  addonGroups: [
    {"id": "coffee-upgrades", "name": "Ship upgrades (coffee)", "cats": ["sailors-delight", "captains-brew", "safe-harbour", "green-lagoon", "bay-breeze"], "items": [{"id": "espresso-shot", "name": "Espresso Shot", "desc": "", "price": 45}, {"id": "syrup", "name": "Syrup", "desc": "", "price": 20}, {"id": "milk", "name": "Milk", "desc": "Oat Milk", "price": 40}, {"id": "whipped-cream", "name": "Whipped Cream", "desc": "", "price": 30}]},
    {"id": "tea-upgrades", "name": "Ship upgrades (tea)", "cats": ["pearls-legends", "pearls-classics", "island-coolers"], "items": [{"id": "pearl", "name": "Pearl", "desc": "", "price": 15}, {"id": "coco-jelly", "name": "Coco Jelly", "desc": "", "price": 15}, {"id": "cream-cheese", "name": "Cream Cheese", "desc": "", "price": 15}, {"id": "bottled-water", "name": "Bottled Water", "desc": "", "price": 20}]},
    {"id": "food-upgrades", "name": "Ship upgrades (food)", "cats": ["main-deck", "wings-of-the-sea", "pier-bites", "portside-plates"], "items": [{"id": "rice", "name": "Rice", "desc": "", "price": 45}, {"id": "pesto-bread", "name": "Pesto Bread", "desc": "", "price": 30}, {"id": "dip", "name": "Dip", "desc": "", "price": 15}]},
  ]
};
