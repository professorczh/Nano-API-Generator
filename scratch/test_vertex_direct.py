import os
import sys

# 强制设置输出编码为 UTF-8，防止 Windows 环境报错
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from google import genai
from google.genai import types

def test_vertex_connection():
    print("Starting Vertex AI connection test...")
    
    try:
        # 初始化 Client
        client = genai.Client(
            vertexai=True,
            location="us-central1"
        )

        model_id = "publishers/google/models/gemini-3.1-flash-lite-preview" 
        print(f"Calling model: {model_id} ...")

        response = client.models.generate_content(
            model=model_id,
            contents="Hello Vertex AI! Are you working?",
            config=types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=100
            )
        )

        print("\nSuccess! Model response:")
        print("-" * 30)
        print(response.text)
        print("-" * 30)

    except Exception as e:
        print("\nFailed! Error information:")
        print(str(e))
        print("\nDebug Tips:")
        if "Credentials" in str(e) or "ADC" in str(e):
            print("- Please run: gcloud auth application-default login")
        elif "Project" in str(e):
            print("- Please set your project: gcloud config set project YOUR_PROJECT_ID")

if __name__ == "__main__":
    test_vertex_connection()
