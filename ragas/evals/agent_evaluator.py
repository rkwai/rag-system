import asyncio
import pandas as pd
import json
import os
import yaml
import logging
from logging.handlers import RotatingFileHandler
from typing import List, Dict, Any, Optional
from utils.agent_interface import (
    call_email_agent,
    call_appointment_agent,
    call_article_writing_agent,
    call_research_agent,
    call_executive_agent
)
from utils.llm_interface import LLMInterface
from utils.evaluation_metrics import (
    faithfulness,
    answer_relevancy,
    context_relevancy,
    task_coordination,
    harmfulness,
    context_recall
)

# Load config
with open("config/config.yaml", 'r') as f:
    config = yaml.safe_load(f)

# Configure logging
log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logs')
os.makedirs(log_dir, exist_ok=True)

# Create data and results directories
data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
results_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'eval_results')
os.makedirs(data_dir, exist_ok=True)
os.makedirs(results_dir, exist_ok=True)

# Create formatters and handlers
file_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
console_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')

def setup_logger(agent_name: str):
    # File handler for agent-specific logs
    file_handler = RotatingFileHandler(
        os.path.join(log_dir, f'{agent_name}_agent.log'),
        maxBytes=10*1024*1024,
        backupCount=5
    )
    file_handler.setFormatter(file_formatter)
    file_handler.setLevel(logging.INFO)

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(console_formatter)
    console_handler.setLevel(os.getenv('LOG_LEVEL', 'INFO'))

    # Configure logger
    logger = logging.getLogger(f'{agent_name}_agent')
    logger.setLevel(logging.INFO)
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    return logger

async def evaluate(data: pd.DataFrame, metrics: List[Any], llm=None) -> Dict[str, float]:
    """Run evaluation metrics on the data"""
    results = {}
    
    for metric in metrics:
        try:
            # Get metric scores for each example
            scores = await asyncio.gather(*[
                metric(row['answer'], row['context'])
                for _, row in data.iterrows()
            ])
            
            # Calculate average score
            metric_name = metric.__name__
            results[metric_name] = sum(scores) / len(scores)
            
        except Exception as e:
            logger.error(f"Error running metric {metric.__name__}: {str(e)}")
            results[metric.__name__] = 0.0
    
    return results

class AgentEvaluator:
    """Class to evaluate agent performance"""

    def __init__(self, agent_type: str):
        """Initialize evaluator with agent type"""
        self.agent_type = agent_type
        self.llm = LLMInterface()
        
        # Load config
        with open("config/config.yaml", 'r') as f:
            self.config = yaml.safe_load(f)
        
        # Get agent config
        self.agent_config = self.config['prompts'][f'{agent_type}_agent']
        
        # Set up metrics based on agent type
        self.metric_functions = {
            'faithfulness': faithfulness,
            'answer_relevancy': answer_relevancy,
            'context_relevancy': context_relevancy
        }
        
        # Add agent-specific metrics
        if agent_type == 'executive':
            self.metric_functions.update({
                'harmfulness': harmfulness,
                'context_recall': context_recall,
                'task_coordination': task_coordination
            })
        elif agent_type == 'article_writing':
            self.metric_functions.update({
                'harmfulness': harmfulness
            })
        elif agent_type == 'research':
            self.metric_functions.update({
                'harmfulness': harmfulness,
                'context_recall': context_recall
            })
        
        # Map agent types to their call functions
        self.agent_calls = {
            'email': self.call_email_agent,
            'appointment': self.call_appointment_agent,
            'article_writing': self.call_article_writing_agent,
            'research': self.call_research_agent,
            'executive': self.call_executive_agent
        }
        self.agent_call = self.agent_calls[agent_type]
        
        # Create directories if they don't exist
        self.log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logs')
        self.results_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'eval_results')
        os.makedirs(self.log_dir, exist_ok=True)
        os.makedirs(self.results_dir, exist_ok=True)
        
        # Set up logging
        self.logger = logging.getLogger(f'{agent_type}_agent')
        self.logger.setLevel(logging.INFO)
        
        # Add file handler
        log_file = os.path.join(self.log_dir, f'{agent_type}_agent.log')
        fh = logging.FileHandler(log_file)
        fh.setLevel(logging.INFO)
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        fh.setFormatter(formatter)
        self.logger.addHandler(fh)
        
        # Add console handler
        ch = logging.StreamHandler()
        ch.setLevel(logging.INFO)
        ch.setFormatter(formatter)
        self.logger.addHandler(ch)

    async def call_email_agent(self, query: str, context: str) -> Dict[str, Any]:
        """Call email agent with query and context"""
        try:
            # Convert functions dict to list format
            functions = []
            for name, spec in self.agent_config['functions'].items():
                func = {
                    'name': name,
                    'description': spec['description'],
                    'parameters': spec['parameters']
                }
                functions.append(func)
            
            response = await self.llm.generate_response(
                system_prompt=self.agent_config['instruction'],
                user_prompt=query,
                context=context,
                available_functions=functions
            )
            return response
        except Exception as e:
            self.logger.error(f"Error calling email agent: {str(e)}")
            raise

    async def call_appointment_agent(self, query: str, context: str) -> Dict[str, Any]:
        """Call appointment agent with query and context"""
        try:
            # Convert functions dict to list format
            functions = []
            for name, spec in self.agent_config['functions'].items():
                func = {
                    'name': name,
                    'description': spec['description'],
                    'parameters': spec['parameters']
                }
                functions.append(func)
            
            response = await self.llm.generate_response(
                system_prompt=self.agent_config['instruction'],
                user_prompt=query,
                context=context,
                available_functions=functions
            )
            return response
        except Exception as e:
            self.logger.error(f"Error calling appointment agent: {str(e)}")
            raise

    async def call_article_writing_agent(self, query: str, context: str) -> Dict[str, Any]:
        """Call article writing agent with query and context"""
        try:
            # Convert functions dict to list format
            functions = []
            for name, spec in self.agent_config['functions'].items():
                func = {
                    'name': name,
                    'description': spec['description'],
                    'parameters': spec['parameters']
                }
                functions.append(func)
            
            response = await self.llm.generate_response(
                system_prompt=self.agent_config['instruction'],
                user_prompt=query,
                context=context,
                available_functions=functions
            )
            return response
        except Exception as e:
            self.logger.error(f"Error calling article writing agent: {str(e)}")
            raise

    async def call_research_agent(self, query: str, context: str) -> Dict[str, Any]:
        """Call research agent with query and context"""
        try:
            # Convert functions dict to list format
            functions = []
            for name, spec in self.agent_config['functions'].items():
                func = {
                    'name': name,
                    'description': spec['description'],
                    'parameters': spec['parameters']
                }
                functions.append(func)
            
            response = await self.llm.generate_response(
                system_prompt=self.agent_config['instruction'],
                user_prompt=query,
                context=context,
                available_functions=functions
            )
            return response
        except Exception as e:
            self.logger.error(f"Error calling research agent: {str(e)}")
            raise

    async def call_executive_agent(self, query: str, context: str) -> Dict[str, Any]:
        """Call executive agent with query and context"""
        try:
            # Convert functions dict to list format
            functions = []
            for name, spec in self.agent_config['functions'].items():
                func = {
                    'name': name,
                    'description': spec['description'],
                    'parameters': spec['parameters']
                }
                functions.append(func)
            
            response = await self.llm.generate_response(
                system_prompt=self.agent_config['instruction'],
                user_prompt=query,
                context=context,
                available_functions=functions
            )
            return response
        except Exception as e:
            self.logger.error(f"Error calling executive agent: {str(e)}")
            raise

    def validate_agent_calls(self, response: Dict[str, Any], expected_calls: List[str]) -> bool:
        """Validate that the agent made the correct function calls"""
        try:
            if not response or 'function_calls' not in response:
                self.logger.error("No function calls found in response")
                return False
                
            response_calls = response.get('function_calls', [])
            if not response_calls:
                self.logger.error("Empty function calls list")
                return False
            
            # Check if all expected agent calls are present
            for expected_call in expected_calls:
                found = False
                for actual_call in response_calls:
                    if actual_call.get('name') == expected_call:
                        found = True
                        break
                if not found:
                    self.logger.error(f"Missing expected agent call: {expected_call}")
                    return False
            return True
        except Exception as e:
            self.logger.error(f"Error validating agent calls: {str(e)}")
            return False

    def validate_task_coordination(self, response: Dict[str, Any], expected_coordination: List[str]) -> bool:
        """Validate task coordination and dependencies"""
        try:
            if not response or 'function_calls' not in response:
                self.logger.error("No function calls found in response")
                return False
                
            coordination = response.get('function_calls', [])
            if not coordination:
                self.logger.error("Empty function calls list")
                return False
            
            actual_sequence = [call.get('name', '') for call in coordination]
            if actual_sequence == expected_coordination:
                return True
                
            self.logger.error(f"Task sequence mismatch. Expected: {expected_coordination}, Got: {actual_sequence}")
            return False
        except Exception as e:
            self.logger.error(f"Error validating task coordination: {str(e)}")
            return False

    def load_data(self, file_path: str) -> pd.DataFrame:
        """Load evaluation data from JSON file"""
        try:
            self.logger.info(f"Loading evaluation data from {file_path}")
            
            if not os.path.exists(file_path):
                self.logger.error(f"Evaluation data file not found: {file_path}")
                # Create example data for testing
                example_data = [
                    {
                        'query': 'Write an email about the research findings and schedule a meeting to discuss.',
                        'context': 'Research findings show improved performance metrics...',
                        'ground_truth': {
                            'function_calls': ['call_research_agent', 'call_email_agent', 'call_appointment_agent']
                        }
                    }
                ]
                os.makedirs(os.path.dirname(file_path), exist_ok=True)
                with open(file_path, 'w') as f:
                    json.dump(example_data, f, indent=2)
                self.logger.info(f"Created example evaluation data in {file_path}")
                return pd.DataFrame(example_data)
            
            with open(file_path, 'r') as f:
                data = json.load(f)
            return pd.DataFrame(data)
        except Exception as e:
            self.logger.error(f"Error loading data: {str(e)}")
            raise

    async def generate_answer(self, query: str, context: str) -> Dict[str, Any]:
        """Generate a single answer using the agent"""
        try:
            return await self.agent_call(query, context)
        except Exception as e:
            self.logger.error(f"Error generating answer: {str(e)}")
            return {'error': str(e)}

    async def generate_answers(self, data: pd.DataFrame) -> pd.DataFrame:
        """Generate answers using the agent"""
        try:
            self.logger.info(f"Generating answers using {self.agent_type} agent")
            
            # Generate answers concurrently
            answers = await asyncio.gather(*[
                self.generate_answer(row['query'], row['context'])
                for _, row in data.iterrows()
            ])
            data['answer'] = answers
            
            # Extract text responses
            data['response'] = data['answer'].apply(lambda x: x.get('content', ''))
            
            # Validate function calls
            if self.agent_type == 'executive':
                data['agent_calls_valid'] = data.apply(
                    lambda row: self.validate_agent_calls(
                        row['answer'],
                        row['ground_truth']['function_calls']
                    ),
                    axis=1
                )
                data['task_coordination_valid'] = data.apply(
                    lambda row: self.validate_task_coordination(
                        row['answer'],
                        row['ground_truth']['function_calls']
                    ),
                    axis=1
                )
            else:
                data['function_calls_score'] = data.apply(
                    lambda row: self.validate_agent_calls(
                        row['answer'],
                        row['ground_truth']['function_calls']
                    ),
                    axis=1
                )
            
            return data
        except Exception as e:
            self.logger.error(f"Error generating answers: {str(e)}")
            raise

    async def run_evaluation(self, eval_data: pd.DataFrame) -> Dict[str, float]:
        """Run evaluation metrics"""
        try:
            self.logger.info("Running evaluation metrics")
            
            # Get metric functions
            metric_funcs = []
            for metric in self.metric_functions:
                if metric in self.metric_functions:
                    metric_funcs.append(self.metric_functions[metric])
                else:
                    self.logger.warning(f"Metric function not found: {metric}")
            
            # Run evaluation
            results = {}
            for metric_func in metric_funcs:
                try:
                    # Get metric scores for each example
                    if metric_func.__name__ == 'task_coordination':
                        scores = await asyncio.gather(*[
                            metric_func(
                                row['answer'],
                                row['ground_truth']['function_calls']
                            )
                            for _, row in eval_data.iterrows()
                        ])
                    else:
                        scores = await asyncio.gather(*[
                            metric_func(row['answer'], row['context'])
                            for _, row in eval_data.iterrows()
                        ])
                    
                    # Calculate average score
                    metric_name = metric_func.__name__
                    results[metric_name] = sum(scores) / len(scores)
                    
                except Exception as e:
                    self.logger.error(f"Error running metric {metric_func.__name__}: {str(e)}")
                    results[metric_func.__name__] = 0.0
            
            # Calculate base metrics
            base_results = {
                'timestamp': pd.Timestamp.now(),
                'num_examples': len(eval_data)
            }
            
            # Add metric scores
            for metric_name, score in results.items():
                base_results[f'{metric_name}_score'] = score * 100
            
            # Add agent-specific metrics
            if self.agent_type == 'executive':
                base_results['agent_calls_accuracy'] = eval_data['agent_calls_valid'].mean() * 100
                base_results['task_coordination_accuracy'] = eval_data['task_coordination_valid'].mean() * 100
            else:
                base_results['function_calls_accuracy'] = eval_data['function_calls_score'].mean() * 100
            
            # Log metrics
            for key, value in base_results.items():
                if key != 'timestamp' and key != 'num_examples':
                    self.logger.info(f"{key.replace('_', ' ').title()}: {value:.2f}%")
            
            # Save results to CSV
            results_file = os.path.join(self.results_dir, f'{self.agent_type}_agent_results.csv')
            self.logger.info(f"Saving results to {results_file}")
            pd.DataFrame([base_results]).to_csv(results_file, index=False)
            self.logger.info("Results saved successfully")
            
            return base_results
        except Exception as e:
            self.logger.error(f"Error running evaluation: {str(e)}")
            raise

    def save_results(self, results: Dict[str, float], output_path: str):
        """Save evaluation results to CSV"""
        try:
            self.logger.info(f"Saving results to {output_path}")
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # Create results DataFrame
            results_df = pd.DataFrame([results])
            
            # Load existing results if they exist
            if os.path.exists(output_path):
                existing_results = pd.read_csv(output_path)
                results_df = pd.concat([existing_results, results_df], ignore_index=True)
            
            # Save all results
            results_df.to_csv(output_path, index=False)
            self.logger.info("Results saved successfully")
        except Exception as e:
            self.logger.error(f"Error saving results: {str(e)}")
            raise

    async def evaluate(self):
        """Run full evaluation pipeline"""
        try:
            self.logger.info(f"Starting {self.agent_type} agent evaluation")
            
            # Load and process data (update file extension)
            eval_data = self.load_data(f"data/{self.agent_type}_agent_eval_data.json")
            eval_data = await self.generate_answers(eval_data)
            
            # Run evaluation
            results = await self.run_evaluation(eval_data)
            
            # Save results
            output_path = f"eval_results/{self.agent_type}_agent_results.csv"
            self.save_results(results, output_path)
            
            self.logger.info(f"{self.agent_type} agent evaluation completed successfully")
            
        except Exception as e:
            self.logger.error(f"{self.agent_type} agent evaluation failed: {str(e)}")
            raise

async def main():
    """Run evaluation for all agents or specific agent"""
    import sys
    
    # Get agent type from command line or run all
    agent_type = sys.argv[1] if len(sys.argv) > 1 else None
    
    if agent_type:
        # Run specific agent evaluation
        evaluator = AgentEvaluator(agent_type)
        await evaluator.evaluate()
    else:
        # Run all agent evaluations
        agent_types = ['email', 'appointment', 'article_writing', 'research', 'executive']
        for agent_type in agent_types:
            evaluator = AgentEvaluator(agent_type)
            await evaluator.evaluate()

if __name__ == "__main__":
    asyncio.run(main()) 