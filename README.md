# Marina Bay's Cafe apps: how to use

Copyright (c) 2026 Marina Bay's Cafe. All rights reserved. See the LICENSE file.

Private tools for running the cafe. They work in a web browser and can be added to a phone's home screen. Everything is saved on the device first, so the apps keep working without internet. Sign in on the Sync page to share changes between phones.

Do not share the repository or the web address outside the cafe.

## A normal day

1. **Start a shift** in Shift (or when the POS asks). Enter the starting cash in the drawer.
2. **Take orders** in the POS and press Charge.
3. **Record expenses** in Expenses as they happen.
4. **Count the cash** in the Money counter, then **end the shift** in Shift. Enter the actual cash and who is closing.
5. **Check the day** in the Calendar.

## POS (pos.html)

- Tap items to build an order. Pick the size and add-ons when asked, and choose dine in or take out.
- **Charge**
  - **Discounts:** turn on PWD (20%), Senior Citizen (20%) or Employee (10%). Several can be on at once and they add up. Each can apply to the whole order or to one item. There is also a free ₱ or % field for other discounts.
  - **Payment:** each payment method has its own amount. Cash can be left blank to cover the rest. Press **Rest** next to a method to fill in whatever is still unpaid after the other amounts. Use the Exact, 100, 200, 500 and 1,000 buttons for cash received.
  - Press **Complete sale**. The receipt prints automatically if a printer is set up (turn this off in Settings). **Print again** is on the next screen.
- **Search** also finds Extras (like Rice) and words in a section's note.
- **Orders** shows today's orders.
  - **PIN approval:** if a PIN is set in Security, Refund, Correct, Delete, Delete shift and any manual "Other discount" ask for the PIN (and an optional reason). Each one is written to the **Activity log** in Settings (kept on that phone only).
  - **Refund:** counts the order as money returned and keeps it in the records.
  - **Correct:** refunds the order and opens a new one with the same items to change.
  - **Delete:** removes the order completely. Only available for orders in the shift that is still open. Use Refund if money was given back.

## Analytics (analytics.html)

- Pick a range (7 days, 30 days, this month, last month, 3 months, all time or your own dates). Cards show income, expenses and profit against the period before.
- Charts: income and expenses with a profit line, running total, where the money goes, sales mix, best weekdays, busy hours, top items and the last 6 months. Tap a bar to see its numbers.

## Check data (checks.html)

- Finds records that may not make sense: a shift left open, a big cash difference, an odd starting cash, orders with no shift or no amount, cash received below the bill, very large or double expenses, expenses dated in the future, and a money count that differs from the shift. Each one has choices (fix, delete or keep). Nothing changes until you tap.

## Shift (shift.html)

- The starting cash is filled in with the same amount as the last shift. The extra cash over it is the cash sales (less cash paid out).

- **Shift** tab: the open shift, its sales so far, and the buttons to start or end it.
- **Ending a shift:** enter the actual cash. The report shows the expected cash, the difference, sales, discounts, refunds, cash and e-wallet totals. Cups and lids are already taken off Inventory as each order is made.
- **History** tab: every closed shift. Open one to print it, see its day in the Calendar, or **Delete shift**. Deleting asks twice and removes the shift and all of its orders (expenses and the money counter are left alone). It can offer to put the cups and lids back in stock.
- Closed shifts cannot be reopened.

## Inventory (inventory.html)

- **Sheet** tab (opens first): the paper count sheet. Pick Bar, Stockroom or Kitchen, then fill **OI | IN | TOTAL | OUT | CI** for today. OI is yesterday's CI. Type what came IN, then either what went OUT or the closing count CI; the other one and the TOTAL are worked out. **Cups and lids come off OUT automatically with every order** and go back if the order is refunded or deleted. Enter jumps to the next item. Past days can be viewed, and **Print** gives the sheet on paper. The list follows the July 9, 2026 sheets; a phone with the older list is moved over automatically and keeps its counts for items with the same name.
- **Stock** tab: every item with a count. Use + and − or type the count. Items start as "out of stock" until you count them.
- **Record used or added stock** (at the top): choose **Used** (loss, spoilage, anything not counted from sales) or **Added** (a delivery or restock), search the item, enter the amount and press Done. The stock count changes right away.
- **Daily** tab: the same table as the Calendar. **Item | Beg | Added | Used | End | Units**, grouped by category.
  - Beg is the previous day's End.
  - Added and Used include changes made with + and −, the record form, and cups and lids taken off when a shift ends.
  - To fix a wrong count, recount the item on the Stock tab. A higher count is recorded as Added and a lower one as Used.
  - **Save as .xlsx** makes a spreadsheet with a Month sheet and a sheet for the day you picked.
- Each item has a **Unit** (pcs, box, pack, bottle or your own). Change the list of units in Settings.
- Data tab: back up, restore or reset the stock list.

## Calendar (calendar.html)

- A month grid that opens on today. Teal numbers are net sales and brown numbers are expenses. Tap a day to see its sales, shifts, money counter, expenses, cups and lids from sales, and the inventory table.
- Used / Added can be recorded here for today or for any of the last 30 days. For an earlier day the stock count today changes by the same amount and the days after it are updated. The Inventory page's record form has a date field too. The table and the xlsx button work for any day.

## Settings (settings.html)

- **Auto-print** the receipt after charging.
- **Payment methods:** Cash is always there. Add e-wallets or cards, or rename them. They can be split with cash when charging.
- **Discounts:** add, rename or change the percentages.
- **Inventory units:** the list offered on the Unit field.
- **Reset settings:** puts only these settings back to the defaults. Sales, shifts, menu, inventory and recipes are never touched. **Undo reset** brings the old settings back.

## Printers and receipts (printers.html)

- **Cash drawer:** plug the drawer into the printer's RJ11/RJ12 socket. In the printer's settings pick **Open on every charge** or **Open on cash sales only**, and press **Test**. If nothing opens, try **Pin 5**. A **Drawer** button then appears in the POS to open it without a sale (this is logged). Does not work with the print dialog.
- Add a printer (Bluetooth or USB) and choose it once. It stays paired until you press **Unpair**. Bluetooth printers reconnect by themselves when the POS opens or the link drops.
- Web Bluetooth does not work in iPhone Safari. Use Chrome on Android or a computer.

## Other pages

| Page | What it does |
|---|---|
| `index.html` | Home page with links to everything |
| `money-counter.html` | Daily cash count |
| `expenses.html` | Daily expenses |
| `recipes.html` | Recipes and cost |
| `menu.html` | Menu editor (items, sizes, prices, add-ons) |
| `data.html` | Backup, restore, and start fresh (set everything to zero) |
| `security.html` | PIN lock |
| `sync.html` | Sign in and see the cloud sync status |

## Backups and cloud sync

- Download a backup from **Data** before deleting or resetting anything real. A backup includes sales, shifts, menu, inventory, the daily inventory record, settings, recipes, counts and expenses.
- When signed in on the Sync page, changes are copied to Firebase and shared between phones. This includes the menu, inventory, daily inventory record, settings, recipes, counts, expenses, sales and shifts. Printer settings, the PIN and the open order stay on each phone.
- Resetting in Data also clears the same data on every other signed-in phone.
- If two phones change the same record, the one saved last wins.
- Firestore rules: the new lists use the collections `sync_config` and `sync_invlog`. If your rules only allow certain collections by name, add these two.

## Dates and time

All dates and times use Philippine time (Asia/Manila), whatever the device's own time zone is. The calendar starts on today's Philippine date and moves to the next day at midnight.

## For the person maintaining the code

- The look (colors, fonts, header) lives in `brand.css`. Change the colors at the top and every page follows.
- Starting data lives in `menu-default.js` and `inventory-default.js`. Once something is changed in an app, the app keeps its own copy on that device.
- `pos-config.js` holds the editable settings, `inv-log.js` the daily inventory record and the .xlsx writer, `shift-lib.js` sales and shifts, `cloud.js` the sync.
- When a file changes, raise the version number in `sw.js` so phones load the new files. The app now opens from the phone's saved copy first (fast on weak internet) and updates in the background, so a new version shows on the second open unless the version number is raised.
- `guard.js` holds the PIN approval and the activity log.
