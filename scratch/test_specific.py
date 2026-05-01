from google import genai

def test_specific_model():
    print("Testing specific 3.1 model...")
    client = genai.Client(vertexai=True, location="us-central1")
    
    # 我们测试几种可能的变体
    candidate_ids = [
        "gemini-3.1-flash-lite-preview",
        "gemini-3.1-flash-lite-preview-001",
        "gemini-3.1-flash-lite"
    ]
    
    for model_id in candidate_ids:
        print(f"\nTrying ID: {model_id} ...")
        try:
            response = client.models.generate_content(
                model=model_id,
                contents="hi",
            )
            print(f"OK! Response: {response.text[:50]}")
            return
        except Exception as e:
            print(f"FAIL: {str(e)[:150]}")

if __name__ == "__main__":
    test_specific_model()
