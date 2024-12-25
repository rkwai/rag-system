import requests
import json
import os
from typing import Dict, List, Optional, Union
from dataclasses import dataclass
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt, IntPrompt
from rich.table import Table
import typer
from enum import Enum
from datetime import datetime

# Initialize Rich console for better output
console = Console()

class ItemType(str, Enum):
    WEAPON = "weapon"
    ARMOR = "armor"
    CONSUMABLE = "consumable"
    QUEST = "quest"
    KEY = "key"

class PlayerClass(str, Enum):
    WARRIOR = "Warrior"
    MAGE = "Mage"
    ROGUE = "Rogue"
    CLERIC = "Cleric"
    RANGER = "Ranger"

@dataclass
class GameState:
    current_scene: str
    active_effects: List[Dict]
    temporary_flags: Dict
    last_action: str
    last_response: str

@dataclass
class RPGClient:
    base_url: str = "http://localhost:8787"
    player_id: Optional[str] = None
    game_history: List[Dict] = None

    def __post_init__(self):
        self.session = requests.Session()
        self.game_history = []

    def _request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict:
        url = f"{self.base_url}{endpoint}"
        console.print(f"[dim]Sending {method} request to {url}[/dim]")
        try:
            response = self.session.request(method, url, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            console.print(f"[red]Error: {str(e)}[/red]")
            if hasattr(e, 'response') and e.response is not None and e.response.content:
                try:
                    error_data = e.response.json()
                    console.print(f"[red]API Error: {error_data.get('error', 'Unknown error')}[/red]")
                except:
                    console.print(f"[red]Response: {e.response.content.decode()}[/red]")
            return {}

    def create_player(self, name: str, player_class: PlayerClass, location: str = "Starting Town") -> Dict:
        data = {
            "name": name,
            "class": player_class,
            "location": location
        }
        return self._request("POST", "/players", data)

    def get_player_details(self) -> Dict:
        if not self.player_id:
            console.print("[red]No player ID set[/red]")
            return {}
        return self._request("GET", f"/players/{self.player_id}")

    def update_location(self, location: str) -> Dict:
        return self._request("PUT", f"/players/{self.player_id}/location", {"location": location})

    def add_experience(self, amount: int, source: str) -> Dict:
        return self._request("POST", f"/players/{self.player_id}/experience", {
            "amount": amount,
            "source": source
        })

    def perform_action(self, action: str) -> Dict:
        player = self.get_player_details()
        if not player:
            return {}

        data = {
            "playerId": self.player_id,
            "action": action,
            "context": {
                "currentLocation": player.get("location", "Unknown"),
                "inventory": player.get("inventory", {}).get("items", []),
                "questStates": [],  # TODO: Implement quest state tracking
                "gameHistory": self.game_history[-5:]  # Keep last 5 actions for context
            }
        }
        
        response = self._request("POST", "/game/action", data)
        if response:
            self.game_history.append({
                "action": action,
                "story": response.get("story", ""),
                "effects": response.get("effects", [])
            })
            self._store_memory(action, response)
        return response

    def _store_memory(self, action: str, response: Dict) -> None:
        player = self.get_player_details()
        if not player:
            return

        memory_data = {
            "playerId": self.player_id,
            "entry": {
                "type": "action",
                "content": f"{action} -> {response.get('story', '')}",
                "location": player.get("location", "Unknown"),
                "timestamp": datetime.now().isoformat(),
                "importance": 0.7,  # Default importance for actions
                "metadata": {
                    "effects": response.get("effects", []),
                    "type": "player_action"
                }
            }
        }
        self._request("POST", "/game/memory", memory_data)

    def save_game_state(self) -> Dict:
        if not self.game_history:
            return {}

        last_action = self.game_history[-1]
        state = {
            "playerId": self.player_id,
            "state": {
                "currentScene": self.get_player_details().get("location", "Unknown"),
                "activeEffects": [],  # TODO: Track active effects
                "temporaryFlags": {},  # TODO: Track temporary flags
                "lastAction": last_action["action"],
                "lastResponse": last_action["story"]
            }
        }
        return self._request("POST", "/game/state", state)

    def load_game_state(self) -> Dict:
        return self._request("GET", f"/game/state/{self.player_id}")

def display_player_info(player_data: Dict):
    if not player_data:
        return

    info_text = (
        f"[bold blue]Player: [/bold blue]{player_data.get('name')}\n"
        f"[bold green]Class: [/bold green]{player_data.get('class')}\n"
        f"[bold yellow]Level: [/bold yellow]{player_data.get('level')}\n"
        f"[bold magenta]Experience: [/bold magenta]{player_data.get('experience')}\n"
        f"[bold cyan]Location: [/bold cyan]{player_data.get('location')}\n"
        f"[bold]Gold: [/bold]{player_data.get('gold')}"
    )
    console.print(Panel(info_text))

    if inventory := player_data.get('inventory', {}).get('items', {}):
        table = Table(title="Inventory")
        table.add_column("Item", style="cyan")
        table.add_column("Quantity", style="magenta")
        table.add_column("Type", style="green")
        
        for item_id, item_data in inventory.items():
            item = item_data.get('item', {})
            table.add_row(
                item.get('name', 'Unknown'),
                str(item_data.get('quantity', 0)),
                item.get('type', 'Unknown')
            )
        console.print(table)

def display_story_response(response: Dict):
    if not response:
        return

    story = response.get("story", "")
    effects = response.get("effects", [])

    console.print(Panel(f"[bold yellow]{story}[/bold yellow]"))
    
    if effects:
        console.print("\n[bold cyan]Effects:[/bold cyan]")
        for effect in effects:
            console.print(f"- {effect.get('type')}: {effect.get('data')}")

def main():
    app = typer.Typer()
    client = RPGClient()

    @app.command()
    def start():
        """Start a new game or continue existing game"""
        player_id = Prompt.ask("Enter your player ID (leave empty for new player)")
        
        if player_id:
            client.player_id = player_id
            player_data = client.get_player_details()
            if player_data:
                console.print("[green]Successfully loaded player![/green]")
                display_player_info(player_data)
                
                # Load game state
                state = client.load_game_state()
                if state:
                    console.print("[green]Loaded previous game state[/green]")
            else:
                console.print("[red]Failed to load player data[/red]")
                return
        else:
            name = Prompt.ask("Enter your character name")
            console.print("\nChoose your class:")
            for player_class in PlayerClass:
                console.print(f"- {player_class.value}")
            
            player_class = Prompt.ask(
                "Enter class name",
                choices=[pc.value for pc in PlayerClass]
            )
            
            player_data = client.create_player(name, player_class)
            if player_data:
                console.print("[green]Successfully created player![/green]")
                client.player_id = player_data.get('id')
                display_player_info(player_data)
            else:
                console.print("[red]Failed to create player[/red]")
                return

        while True:
            action = Prompt.ask(
                "\nWhat would you like to do?",
                choices=["act", "status", "move", "save", "quit"]
            )

            if action == "quit":
                # Save game state before quitting
                client.save_game_state()
                break
            elif action == "status":
                display_player_info(client.get_player_details())
            elif action == "act":
                player_action = Prompt.ask("What would you like to do? (describe your action)")
                response = client.perform_action(player_action)
                if response:
                    display_story_response(response)
            elif action == "move":
                new_location = Prompt.ask("Enter new location")
                result = client.update_location(new_location)
                if result:
                    console.print(f"[green]Moved to {new_location}[/green]")
                    display_player_info(result)
            elif action == "save":
                if client.save_game_state():
                    console.print("[green]Game state saved![/green]")

    app()

if __name__ == "__main__":
    main() 