from google import genai
import sys

def auto_probe_models():
    print("Starting auto-probe of Vertex AI models...")
    location = "us-central1"
    try:
        client = genai.Client(vertexai=True, location=location)
        
        print(f"Fetching models in {location}...")
        models = list(client.models.list())
        
        if not models:
            print("No models found.")
            return

        # 找出名字里包含 gemini 的模型
        gemini_models = [m for m in models if "gemini" in m.name.lower()]
        print(f"Found {len(gemini_models)} Gemini models. Probing first 5...")

        for model in gemini_models[:5]:
            # 提取短 ID (去掉 publishers/google/models/ 前缀)
            short_id = model.name.split('/')[-1]
            print(f"\n--- Testing: {short_id} ---")
            try:
                response = client.models.generate_content(
                    model=short_id,
                    contents="hi",
                )
                print(f"OK! Response: {response.text[:50]}...")
                print(f"Use this ID: {short_id}")
                return # 只要找到一个成功的就停下
            except Exception as e:
                print(f"FAIL: {str(e)[:100]}...")

    except Exception as e:
        print(f"Critical Error: {str(e)}")

if __name__ == "__main__":
    auto_probe_models()
