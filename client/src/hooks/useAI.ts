import { useState, useCallback, useEffect } from 'react';
import {
  getAIEngine,
  KnowledgeEntry,
  Interaction,
  LearningSession,
} from '@/lib/aiLearning';

export function useAI() {
  const [sessionId] = useState(() => `session_${Date.now()}`);
  const [currentSession, setCurrentSession] = useState<LearningSession | null>(null);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeEntry[]>([]);
  const [stats, setStats] = useState({
    totalInteractions: 0,
    totalLearned: 0,
    averageConfidence: 0,
    knowledgeCount: 0,
    sessionCount: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  const engine = getAIEngine();

  // Carrega dados iniciais
  useEffect(() => {
    const session = engine.getSession(sessionId);
    setCurrentSession(session || null);
    setKnowledgeBase(engine.getKnowledgeBase());
    setStats(engine.getStats());
  }, [sessionId, engine]);

  /**
   * Adiciona novo conhecimento
   */
  const addKnowledge = useCallback(
    (topic: string, content: string, tags: string[] = []) => {
      setIsLoading(true);
      try {
        const entry = engine.addKnowledge(topic, content, tags);
        setKnowledgeBase(engine.getKnowledgeBase());
        setStats(engine.getStats());
        return entry;
      } finally {
        setIsLoading(false);
      }
    },
    [engine]
  );

  /**
   * Processa uma pergunta
   */
  const askQuestion = useCallback(
    (question: string) => {
      setIsLoading(true);
      try {
        const interaction = engine.processQuestion(question, sessionId);
        const session = engine.getSession(sessionId);
        setCurrentSession(session || null);
        setStats(engine.getStats());
        return interaction;
      } finally {
        setIsLoading(false);
      }
    },
    [engine, sessionId]
  );

  /**
   * Marca feedback de uma interação
   */
  const markFeedback = useCallback(
    (interactionId: string, helpful: boolean) => {
      setIsLoading(true);
      try {
        engine.markInteractionFeedback(interactionId, helpful, sessionId);
        setKnowledgeBase(engine.getKnowledgeBase());
        setStats(engine.getStats());
      } finally {
        setIsLoading(false);
      }
    },
    [engine, sessionId]
  );

  /**
   * Exporta dados
   */
  const exportData = useCallback(() => {
    return engine.exportData();
  }, [engine]);

  /**
   * Importa dados
   */
  const importData = useCallback((data: ReturnType<typeof engine.exportData>) => {
    setIsLoading(true);
    try {
      engine.importData(data);
      setKnowledgeBase(engine.getKnowledgeBase());
      setStats(engine.getStats());
    } finally {
      setIsLoading(false);
    }
  }, [engine]);

  /**
   * Limpa todos os dados
   */
  const clearAll = useCallback(() => {
    setIsLoading(true);
    try {
      engine.clearAll();
      setCurrentSession(null);
      setKnowledgeBase([]);
      setStats({
        totalInteractions: 0,
        totalLearned: 0,
        averageConfidence: 0,
        knowledgeCount: 0,
        sessionCount: 0,
      });
    } finally {
      setIsLoading(false);
    }
  }, [engine]);

  return {
    sessionId,
    currentSession,
    knowledgeBase,
    stats,
    isLoading,
    addKnowledge,
    askQuestion,
    markFeedback,
    exportData,
    importData,
    clearAll,
  };
}

