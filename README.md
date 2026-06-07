# Sternishop

A personal star tracker and reward shop. Complete tasks to earn stars, spend them on things you enjoy, and redeem or return items from your inventory.

## Running locally

```
npm install
npm start
```

Then open `http://localhost:3000`.

## Running with Docker

```
docker build -t sternishop .
docker run -p 3000:3000 -v "${PWD}/persistence:/app/persistence" sternishop
```

The volume mount keeps your data (`persistence/stars.json`) on your machine so it survives container restarts. Without it, all data resets when the container is removed.

On Windows PowerShell use `${PWD}`; on Linux/macOS use `$(pwd)`.

## Customising

### Adding or changing tasks

Edit `tasks.js`. Each entry has three fields:

```js
{
  id: 'some-unique-id',   // must be unique, used internally
  name: 'Task label',     // shown in the UI
  reward: 1,              // stars awarded on completion
}
```

Tasks can be completed any number of times.

### Adding or changing shop items

Edit `shop.js`. Each entry has four fields:

```js
{
  id: 'some-unique-id',   // must be unique, used internally
  name: 'Item name',      // shown in the UI and inventory
  emoji: '🎬',            // shown as the ticket icon
  cost: 5,                // stars deducted on purchase
}
```

The full cost is refunded if an item is returned from inventory.

### Changing the port

The server listens on port `3000` by default. To change it, edit the `PORT` constant at the top of `server.js`, and update the `EXPOSE` line and `-p` flag in your Docker command accordingly.

### Data file

All state (star count and inventory) is stored in `persistence/stars.json`. You can edit it directly if you need to reset or adjust values:

```json
{
  "stars": 0,
  "inventory": []
}
```
