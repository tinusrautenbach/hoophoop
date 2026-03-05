# API Contract: Stat Configuration Endpoints

**Base Path**: `/api/games/[id]/stat-config`

---

## GET /api/games/[id]/stat-config

Retrieve the stat configuration for a game.

### Request

```http
GET /api/games/550e8400-e29b-41d4-a716-446655440000/stat-config
Authorization: Bearer <token>
```

### Response 200 OK

```json
{
  "id": "config-uuid",
  "gameId": "550e8400-e29b-41d4-a716-446655440000",
  "seasonId": "season-uuid",
  "communityId": "community-uuid",
  "enabledStats": [
    "points_1pt",
    "points_2pt", 
    "points_3pt",
    "rebound_off",
    "rebound_def",
    "assist",
    "steal",
    "block"
  ],
  "displayConfig": {
    "statOrder": ["points_2pt", "points_3pt", "rebound_total", "assist"],
    "groupings": [
      { "name": "Scoring", "stats": ["points_1pt", "points_2pt", "points_3pt"] },
      { "name": "Rebounds", "stats": ["rebound_off", "rebound_def"] }
    ]
  },
  "allowCustomization": true,
  "trackFullHistory": false,
  "createdAt": "2026-03-05T10:00:00Z",
  "updatedAt": "2026-03-05T10:00:00Z",
  "createdBy": "user-uuid",
  "updatedBy": "user-uuid"
}
```

### Response 404 Not Found

```json
{
  "error": "Stat configuration not found for this game"
}
```

---

## POST /api/games/[id]/stat-config

Create or update the stat configuration for a game.

### Request

```http
POST /api/games/550e8400-e29b-41d4-a716-446655440000/stat-config
Authorization: Bearer <token>
Content-Type: application/json

{
  "enabledStats": ["points_2pt", "points_3pt", "rebound_off", "rebound_def", "assist"],
  "displayConfig": {
    "statOrder": ["points_2pt", "points_3pt", "rebound_total", "assist"]
  },
  "allowCustomization": true,
  "trackFullHistory": false
}
```

### Request Schema

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `enabledStats` | string[] | Yes | Min 1 item, all valid PrimaryStatType values |
| `displayConfig` | object | No | See data model for schema |
| `allowCustomization` | boolean | No | Default: true |
| `trackFullHistory` | boolean | No | Default: false |

### Response 200 OK (Updated)

```json
{
  "id": "config-uuid",
  "gameId": "550e8400-e29b-41d4-a716-446655440000",
  "enabledStats": ["points_2pt", "points_3pt", "rebound_off", "rebound_def", "assist"],
  "allowCustomization": true,
  "updatedAt": "2026-03-05T11:00:00Z",
  "updatedBy": "user-uuid"
}
```

### Response 201 Created (New)

```json
{
  "id": "new-config-uuid",
  "gameId": "550e8400-e29b-41d4-a716-446655440000",
  "enabledStats": ["points_2pt", "points_3pt", "rebound_off", "rebound_def", "assist"],
  "allowCustomization": true,
  "createdAt": "2026-03-05T11:00:00Z",
  "createdBy": "user-uuid"
}
```

### Response 400 Bad Request

```json
{
  "error": "Invalid stat type",
  "details": ["'invalid_stat' is not a valid stat type"]
}
```

### Response 403 Forbidden

```json
{
  "error": "Only game owner or community admin can modify stat configuration"
}
```

### Response 409 Conflict (Data Exists)

```json
{
  "error": "Cannot disable stat with existing data",
  "statType": "rebound_off",
  "eventCount": 5,
  "message": "This stat has 5 recorded events. Disabling will hide existing data but not delete it."
}
```

---

## DELETE /api/games/[id]/stat-config

Delete the stat configuration (rarely used - prefer disabling all stats instead).

### Request

```http
DELETE /api/games/550e8400-e29b-41d4-a716-446655440000/stat-config
Authorization: Bearer <token>
```

### Response 204 No Content

### Response 403 Forbidden

```json
{
  "error": "Only game owner can delete stat configuration"
}
```

---

## GET /api/games/[id]/stat-config/inheritance

Get the inheritance chain for stat configuration.

### Request

```http
GET /api/games/550e8400-e29b-41d4-a716-446655440000/stat-config/inheritance
Authorization: Bearer <token>
```

### Response 200 OK

```json
{
  "game": {
    "enabledStats": ["points_2pt", "points_3pt", "assist"],
    "source": "game_override"
  },
  "season": {
    "id": "season-uuid",
    "name": "2026 Spring Season",
    "enabledStats": ["points_2pt", "points_3pt", "rebound_total", "assist", "steal"],
    "source": "season_default"
  },
  "community": {
    "id": "community-uuid",
    "name": "Metro League",
    "enabledStats": ["points_2pt", "points_3pt", "rebound_total", "assist", "steal", "block"],
    "source": "community_default"
  }
}
```
