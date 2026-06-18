import asyncio
from config import get_settings
from langchain_google_genai import ChatGoogleGenerativeAI

async def test():
    settings = get_settings()
    
    fallback = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        api_key=settings.GEMINI_API_KEY_FALLBACK,
        temperature=0.7,
        max_retries=0,
    )
    
    try:
        print("Invoking fallback key directly...")
        res = await fallback.ainvoke("Hello!")
        print("Success:", res.content)
    except Exception as e:
        print("Failed:", e)

if __name__ == "__main__":
    asyncio.run(test())
