import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'pipeline'))

from context.prompt_builder import build_system_prompt

# Case 1: summary_ready=True
prompt1 = build_system_prompt(
    summary="This is a summary of the video.",
    relevant_chunks=[{"start": 10.0, "end": 20.0, "text": "This is a chunk."}],
    summary_ready=True
)
print("=== CASE 1 ===")
print(prompt1)

# Case 2: summary_ready=False but retrieval is good
prompt2 = build_system_prompt(
    summary="",
    relevant_chunks=[{"start": 10.0, "end": 20.0, "text": "This is a good chunk."}],
    summary_ready=False
)
print("\n=== CASE 2 ===")
print(prompt2)

# Case 3: summary_ready=False and retrieval is weak (empty chunks)
prompt3 = build_system_prompt(
    summary="",
    relevant_chunks=[],
    summary_ready=False
)
print("\n=== CASE 3 ===")
print(prompt3)
