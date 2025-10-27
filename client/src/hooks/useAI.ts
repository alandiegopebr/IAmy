import { useState, useCallback, useEffect } from 'react';
import {
  getAIEngine,
  KnowledgeEntry,
  Interaction,
  LearningSession,
  LearningProposal,
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
  const [proposals, setProposals] = useState<LearningProposal[]>([]);
  const [autonomousEnabled, setAutonomousEnabled] = useState<boolean>(false);
  // nota: suporte a provedores externos sem chave (SerpAPI) removido — usa apenas buscas HTML e crawl
  const [isLoading, setIsLoading] = useState(false);

  const engine = getAIEngine();

  // Carrega dados iniciais
  useEffect(() => {
    const session = engine.getSession(sessionId);
    setCurrentSession(session || null);
    setKnowledgeBase(engine.getKnowledgeBase());
    setStats(engine.getStats());
    setProposals(engine.getProposals());
    setAutonomousEnabled(engine.isAutonomousLearningEnabled());
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
        // atualizar propostas caso o engine gere alguma automaticamente
        setProposals(engine.getProposals());
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
   * Pesquisa na web (servidor) e aprende automaticamente caso autoApprove seja true.
   */
  type ResearchOptions = { deep?: boolean };

  const researchTopic = useCallback(async (topic: string, autoApprove = false, options: ResearchOptions = {}) => {
    setIsLoading(true);
    try {
      if (!topic || !topic.trim()) throw new Error('Topic required');
      let data: any = null;
      try {
        const resp = await fetch(`/api/research?topic=${encodeURIComponent(topic)}${options.deep ? '&deep=1' : ''}`);
        if (!resp.ok) {
          // try to read body for debugging
          const err = await resp.json().catch(() => ({}));
          console.error('research fetch non-ok', err);
          return { approved: false, notFound: true, error: 'server_non_ok', details: err };
        }
        data = await resp.json();
      } catch (fetchErr) {
        console.error('research fetch error:', fetchErr);
        return { approved: false, notFound: true, error: 'network' };
      }
      const summary = data.summary || '';
      const title = data.topic || topic;

      // If nothing was found, return notFound info instead of creating empty knowledge
      if (!summary || summary.trim() === '' || (data.notFound === true)) {
        return { approved: false, notFound: true, data };
      }

  if (autoApprove) {
        // If deep research returned fragments, create multiple knowledge entries (one per fragment)
        if (Array.isArray(data.fragments) && data.fragments.length > 0) {
          const entries = data.fragments.map((frag: any, idx: number) => {
            // suportar formato antigo (string) e novo (obj: {text, code[]})
            const fragText = typeof frag === 'string' ? frag : (frag.text || '');
            const codes: Array<{ code: string; lang?: string }> = Array.isArray(frag?.code) ? frag.code : [];
            // anexar exemplos de código ao conteúdo, formatados em bloco incluindo linguagem quando disponível
            const codeSection = codes.length > 0
              ? '\n\nExemplos de código:\n' + codes.map(c => `\n\n${c.lang ? '```' + c.lang : '```'}\n${c.code}\n\n\`\`\``).join('\n')
              : '';
            const combined = (fragText || '') + codeSection;
            const src = (data.sources && data.sources[idx]) || null;
            const topicTitle = src ? `${title} — fonte ${new URL(src).host}` : title;
            // collect language tags
            const codeLangs = codes.map(c => c.lang).filter(Boolean) as string[];
            const tags = src ? [new URL(src).host, ...codeLangs] : [...codeLangs];
            return engine.addKnowledge(topicTitle, combined, tags);
          });
          setKnowledgeBase(engine.getKnowledgeBase());
          setStats(engine.getStats());
          return { approved: true, entries };
        }

        const entry = engine.addKnowledge(title, summary, []);
        setKnowledgeBase(engine.getKnowledgeBase());
        setStats(engine.getStats());
        return { approved: true, entry };
      } else {
        // If deep option requested, return the full research data for preview (UI will decide what to import)
        if (options.deep) {
          return { approved: false, data };
        }
        // For non-deep requests without auto-approve, create a proposal to be reviewed later
        const proposal = engine.createProposal(title, summary, null);
        setProposals(engine.getProposals());
        return { approved: false, proposal };
      }
    } finally {
      setIsLoading(false);
    }
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
      setProposals(engine.getProposals());
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
      setProposals([]);
      setAutonomousEnabled(engine.isAutonomousLearningEnabled());
    } finally {
      setIsLoading(false);
    }
  }, [engine]);

  /**
   * Controle para aprendizagem autônoma (ativa apenas se user permitir)
   */
  const setAutonomousLearning = useCallback((enabled: boolean) => {
    setIsLoading(true);
    try {
      engine.setAutonomousLearning(enabled);
      setAutonomousEnabled(engine.isAutonomousLearningEnabled());
      // opcional: gerar propostas do histórico quando habilitar
      if (enabled) {
        engine.generateProposalsFromHistory();
        setProposals(engine.getProposals());
      }
    } finally {
      setIsLoading(false);
    }
  }, [engine]);

  const getProposals = useCallback(() => {
    return engine.getProposals();
  }, [engine]);

  const approveProposal = useCallback((proposalId: string) => {
    setIsLoading(true);
    try {
      const entry = engine.approveProposal(proposalId);
      setKnowledgeBase(engine.getKnowledgeBase());
      setProposals(engine.getProposals());
      setStats(engine.getStats());
      return entry;
    } finally {
      setIsLoading(false);
    }
  }, [engine]);

  const rejectProposal = useCallback((proposalId: string) => {
    setIsLoading(true);
    try {
      const ok = engine.rejectProposal(proposalId);
      setProposals(engine.getProposals());
      return ok;
    } finally {
      setIsLoading(false);
    }
  }, [engine]);

  const searchKnowledge = useCallback((query: string) => {
    try {
      return engine.searchKnowledge(query || '');
    } catch (err) {
      console.error('searchKnowledge error', err);
      return [] as any[];
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
    // Autonomy & proposals
    proposals,
    autonomousEnabled,
    setAutonomousLearning,
    getProposals,
    approveProposal,
    rejectProposal,
    researchTopic,
    
    searchKnowledge,
  };
}

