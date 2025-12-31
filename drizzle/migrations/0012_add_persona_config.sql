-- Add persona_config JSONB column to chatbots table
-- For Intent-Aware RAG system: stores chatbot personality and expertise area

ALTER TABLE chatbots
ADD COLUMN persona_config JSONB DEFAULT '{
  "name": "AI 어시스턴트",
  "expertiseArea": "기업 문서 및 FAQ",
  "tone": "friendly"
}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN chatbots.persona_config IS 'Intent-Aware RAG 페르소나 설정: name(챗봇 이름), expertiseArea(전문 분야), tone(대화 어조)';
