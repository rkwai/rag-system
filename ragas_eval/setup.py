from setuptools import setup, find_packages

setup(
    name="ragas_eval",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "ragas>=0.2.9",
        "datasets>=2.15.0",
        "pandas>=2.0.0",
        "pyyaml>=6.0.1",
        "torch>=2.1.0",
        "transformers>=4.36.0",
        "numpy>=1.24.0",
        "python-dotenv>=1.0.0"
    ],
    python_requires=">=3.8",
) 