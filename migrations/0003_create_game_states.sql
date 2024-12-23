-- Create game states table
CREATE TABLE IF NOT EXISTS game_states (
  player_id TEXT PRIMARY KEY,
  current_scene TEXT NOT NULL,
  active_effects TEXT NOT NULL, -- JSON array of effects
  temporary_flags TEXT NOT NULL, -- JSON object of flags
  last_action TEXT NOT NULL,
  last_response TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_game_states_player_id ON game_states(player_id);

-- Create trigger to update the updated_at timestamp
CREATE TRIGGER IF NOT EXISTS game_states_updated_at
AFTER UPDATE ON game_states
BEGIN
  UPDATE game_states SET updated_at = CURRENT_TIMESTAMP WHERE player_id = NEW.player_id;
END; 