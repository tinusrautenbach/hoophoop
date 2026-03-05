# API Contract: Scorer Stat Focus Endpoints

**Base Path**: `/api/games/[id]/scorer-focus`

---

## GET /api/games/[id]/scorer-focus

Retrieve the current scorer's stat focus for this game.

### Request

```http
GET /api/games/550e8400-e29b-41d4-a716-446655440000/scorer-focus
Authorization: Bearer <token>
```

### Response 200 OK

```json
{
  "gameId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-uuid",
  "statFocus": ["points_2pt", "points_3pt", "rebound_total"],
  "showAllStats": false,
  "focusUpdatedAt": "2026-03-05T10:30:00Z",
  "source": "per_game" // or "global_default" or "game_default"
}
```

### Response 200 OK (No Focus Set)

```json
{
  "gameId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-uuid",
  "statFocus": ["points_2pt", "points_3pt", "assist"], // Game defaults
  "showAllStats": false,
  "source": "game_default"
}
```

---

## POST /api/games/[id]/scorer-focus

Set or update the scorer's stat focus for this game.

### Request

```http
POST /api/games/550e8400-e29b-41d4-a716-446655440000/scorer-focus
Authorization: Bearer <token>
Content-Type: application/json

{
  "statFocus": ["points_2pt", "assist", "steal"],
  "showAllStats": false
}
```

### Request Schema

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `statFocus` | string[] | Yes | 1-3 items, all enabled for this game |
| `showAllStats` | boolean | No | Default: false |

### Response 200 OK

```json
{
  "gameId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-uuid",
  "statFocus": ["points_2pt", "assist", "steal"],
  "showAllStats": false,
  "focusUpdatedAt": "2026-03-05T11:00:00Z"
}
```

### Response 400 Bad Request

```json
{
  "error": "Invalid stat focus",
  "details": [
    "Stat focus must contain 1-3 stats",
    "'invalid_stat' is not a valid stat type",
    "'rebound_total' is not enabled for this game"
  ]
}
```

### Response 403 Forbidden

```json
{
  "error": "You must be an active scorer for this game"
}
```

---

## GET /api/games/[id]/scorer-focus/global

Retrieve the user's global default stat focus (applies to new games).

### Request

```http
GET /api/games/550e8400-e29b-41d4-a716-446655440000/scorer-focus/global
Authorization: Bearer <token>
```

### Response 200 OK

```json
{
  "userId": "user-uuid",
  "statFocus": ["points_2pt", "points_3pt", "rebound_total"],
  "showAllStats": false
}
```

---

## POST /api/games/[id]/scorer-focus/global

Set the user's global default stat focus.

### Request

```http
POST /api/games/550e8400-e29b-41d4-a716-446655440000/scorer-focus/global
Authorization: Bearer <token>
Content-Type: application/json

{
  "statFocus": ["points_2pt", "assist", "steal"],
  "showAllStats": false
}
```

### Response 200 OK

```json
{
  "userId": "user-uuid",
  "statFocus": ["points_2pt", "assist", "steal"],
  "showAllStats": false,
  "updatedAt": "2026-03-05T11:00:00Z"
}
```

---

## GET /api/games/[id]/scorer-focus/all

Get all scorers' stat focuses for this game (for coordination).

### Request

```http
GET /api/games/550e8400-e29b-41d4-a716-446655440000/scorer-focus/all
Authorization: Bearer <token>
```

### Response 200 OK

```json
{
  "scorers": [
    {
      "userId": "user-1-uuid",
      "displayName": "John Smith",
      "statFocus": ["points_2pt", "points_3pt"],
      "showAllStats": false
    },
    {
      "userId": "user-2-uuid",
      "displayName": "Jane Doe",
      "statFocus": ["rebound_off", "rebound_def", "assist"],
      "showAllStats": true
    }
  ]
}
```

### Response 403 Forbidden

```json
{
  "error": "Only game owner and scorers can view all focuses"
}
```
