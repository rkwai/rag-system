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

class QuestDifficulty(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    EPIC = "epic"

@dataclass
class RPGClient:
    base_url: str = "http://localhost:8787"
    token: Optional[str] = None
    player_id: Optional[str] = None

    def __post_init__(self):
        self.session = requests.Session()
        if self.token:
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})

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
                    console.print(f"[red]API Error: {error_data.get('error', {}).get('message', 'Unknown error')}[/red]")
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

    def get_quest(self, difficulty: QuestDifficulty = QuestDifficulty.MEDIUM) -> Dict:
        player = self.get_player_details()
        if not player:
            return {}
        
        data = {
            "player": {
                "id": self.player_id,
                "level": player.get("level", 1),
                "class": player.get("class"),
                "location": player.get("location")
            },
            "difficulty": difficulty,
            "useHistory": True
        }
        return self._request("POST", "/quests", data)

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

def format_quest_display(quest_data: Dict) -> str:
    objectives = "\n".join(f"- {obj.get('description')}" for obj in quest_data.get('objectives', []))
    rewards = "\n".join(f"- {reward.get('type')}: {reward.get('amount')}" for reward in quest_data.get('rewards', []))
    
    return (
        f"[bold]Quest: [/bold]{quest_data.get('title')}\n"
        f"[bold]Description: [/bold]{quest_data.get('description')}\n\n"
        f"[bold]Objectives:[/bold]\n{objectives}\n\n"
        f"[bold]Rewards:[/bold]\n{rewards}"
    )

def main():
    app = typer.Typer()
    client = RPGClient()

    @app.command()
    def start():
        """Start a new game or continue existing game"""
        token = Prompt.ask("Enter your player token (leave empty for new player)")
        
        if token:
            client.token = token
            player_id = Prompt.ask("Enter your player ID")
            client.player_id = player_id
            player_data = client.get_player_details()
            if player_data:
                console.print("[green]Successfully loaded player![/green]")
                display_player_info(player_data)
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
                choices=["status", "quest", "move", "quit"]
            )

            if action == "quit":
                break
            elif action == "status":
                display_player_info(client.get_player_details())
            elif action == "quest":
                difficulty = Prompt.ask(
                    "Choose quest difficulty",
                    choices=[d.value for d in QuestDifficulty]
                )
                quest_data = client.get_quest(difficulty)
                if quest_data:
                    console.print(Panel(format_quest_display(quest_data)))
            elif action == "move":
                new_location = Prompt.ask("Enter new location")
                result = client.update_location(new_location)
                if result:
                    console.print(f"[green]Moved to {new_location}[/green]")
                    display_player_info(result)

    app()

if __name__ == "__main__":
    main() 