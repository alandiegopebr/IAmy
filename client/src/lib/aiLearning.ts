/**
 * Sistema de IA com Aprendizado Incremental
 * Armazena conhecimento em localStorage e aprende com o tempo
 */

export interface KnowledgeEntry {
  id: string;
  topic: string;
  content: string;
  timestamp: number;
  relevance: number; // 0-100
  tags: string[];
}

export interface LearningSession {
  id: string;
  createdAt: number;
  interactions: Interaction[];
}

export interface LearningProposal {
  id: string;
  topic: string;
  content: string;
  sourceInteractionId?: string | null;
  timestamp: number;
}

export interface Interaction {
  id: string;
  question: string;
  answer: string;
  timestamp: number;
  confidence: number; // 0-100
  helpful: boolean | null;
}

const STORAGE_KEYS = {
  KNOWLEDGE_BASE: 'ai_knowledge_base',
  LEARNING_SESSIONS: 'ai_learning_sessions',
  STATS: 'ai_stats',
  PROPOSALS: 'ai_learning_proposals',
  SETTINGS: 'ai_learning_settings',
};

class AILearningEngine {
  private knowledgeBase: Map<string, KnowledgeEntry> = new Map();
  private sessions: Map<string, LearningSession> = new Map();
  private stats = {
    totalInteractions: 0,
    totalLearned: 0,
    averageConfidence: 0,
  };
  private proposals: Map<string, LearningProposal> = new Map();
  private settings = {
    autonomousLearning: false,
  };

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Adiciona novo conhecimento à base
   */
  addKnowledge(
    topic: string,
    content: string,
    tags: string[] = []
  ): KnowledgeEntry {
    const id = `knowledge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const entry: KnowledgeEntry = {
      id,
      topic,
      content,
      timestamp: Date.now(),
      relevance: 50, // Começa com relevância média
      tags,
    };

    this.knowledgeBase.set(id, entry);
    this.stats.totalLearned++;
    this.saveToStorage();

    return entry;
  }

  /**
   * Retorna se a aprendizagem autônoma está ativada
   */
  isAutonomousLearningEnabled(): boolean {
    return !!this.settings.autonomousLearning;
  }

  /**
   * Ativa/Desativa aprendizagem autônoma (configuração armazenada)
   */
  setAutonomousLearning(enabled: boolean): void {
    this.settings.autonomousLearning = !!enabled;
    this.saveToStorage();
  }

  /**
   * Retorna propostas de aprendizagem pendentes
   */
  getProposals(): LearningProposal[] {
    return Array.from(this.proposals.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Gera uma proposta de aprendizagem -- NÃO adiciona diretamente ao conhecimento.
   */
  createProposal(topic: string, content: string, sourceInteractionId?: string | null): LearningProposal {
    const id = `proposal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const proposal: LearningProposal = {
      id,
      topic,
      content,
      sourceInteractionId: sourceInteractionId || null,
      timestamp: Date.now(),
    };
    this.proposals.set(id, proposal);
    this.saveToStorage();
    return proposal;
  }

  /**
   * Aprova uma proposta: converte em conhecimento
   */
  approveProposal(proposalId: string): KnowledgeEntry | null {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) return null;
    const entry = this.addKnowledge(proposal.topic, proposal.content, []);
    this.proposals.delete(proposalId);
    this.saveToStorage();
    return entry;
  }

  /**
   * Rejeita/descarta uma proposta
   */
  rejectProposal(proposalId: string): boolean {
    const existed = this.proposals.delete(proposalId);
    if (existed) this.saveToStorage();
    return existed;
  }

  /**
   * Processa uma pergunta e gera resposta baseada no conhecimento
   */
  processQuestion(question: string, sessionId: string): Interaction {
    const id = `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Extrai palavras-chave da pergunta
    const keywords = this.extractKeywords(question);
    
    // Busca conhecimento relevante
    const relevantKnowledge = this.findRelevantKnowledge(keywords);
    
    // Gera resposta
    const answer = this.generateAnswer(question, relevantKnowledge);
    
    // Calcula confiança baseada na quantidade de conhecimento relevante
    const confidence = Math.min(
      100,
      Math.max(20, relevantKnowledge.length * 25)
    );

    const interaction: Interaction = {
      id,
      question,
      answer,
      timestamp: Date.now(),
      confidence,
      helpful: null,
    };

    // Adiciona à sessão
    if (this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId)!;
      session.interactions.push(interaction);
    } else {
      const session: LearningSession = {
        id: sessionId,
        createdAt: Date.now(),
        interactions: [interaction],
      };
      this.sessions.set(sessionId, session);
    }

    this.stats.totalInteractions++;
    this.updateAverageConfidence();
    this.saveToStorage();

    // Se aprendizado autônomo está ativado, gerar propostas baseadas em interações fracas
    try {
      if (this.isAutonomousLearningEnabled()) {
        this.maybeGenerateProposalFromInteraction(interaction);
      }
    } catch (err) {
      // não bloquear o fluxo de respostas
      console.error('Erro ao gerar proposta autônoma:', err);
    }

    return interaction;
  }

  /**
   * Marca uma interação como útil ou não, ajustando a relevância do conhecimento
   */
  markInteractionFeedback(
    interactionId: string,
    helpful: boolean,
    sessionId: string
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const interaction = session.interactions.find(i => i.id === interactionId);
    if (!interaction) return;

    interaction.helpful = helpful;

    // Ajusta relevância do conhecimento usado
    if (helpful) {
      const keywords = this.extractKeywords(interaction.question);
      const relevantKnowledge = this.findRelevantKnowledge(keywords);
      
      relevantKnowledge.forEach(entry => {
        entry.relevance = Math.min(100, entry.relevance + 10);
      });
    } else {
      const keywords = this.extractKeywords(interaction.question);
      const relevantKnowledge = this.findRelevantKnowledge(keywords);
      
      relevantKnowledge.forEach(entry => {
        entry.relevance = Math.max(0, entry.relevance - 5);
      });
    }

    this.saveToStorage();
  }

  /**
   * Analisa uma interação e, se apropriado, cria uma proposta de aprendizagem
   * Essa proposta só será convertida em conhecimento se o usuário aprovar.
   */
  private maybeGenerateProposalFromInteraction(interaction: Interaction) {
    // Regras simples:
    // - Se confiança baixa (<=40) ou resposta pedindo para ensinar, sugerir proposta
    const answerIndicatesLack = /desculpe, ainda não tenho conhecimento suficiente|poderia me ensinar|ensine/i;

    if (interaction.confidence <= 40 || answerIndicatesLack.test(interaction.answer)) {
      const keywords = this.extractKeywords(interaction.question);
      const topic = keywords.slice(0, 3).join(' ') || interaction.question.substring(0, 50);
      const content = `Proposta gerada automaticamente a partir da interação: pergunta="${interaction.question}" resposta="${interaction.answer}"`;
      this.createProposal(topic, content, interaction.id);
    }
  }

  /**
   * Gera propostas a partir de todo o histórico de sessões (idempotente)
   */
  generateProposalsFromHistory(): void {
    this.sessions.forEach(session => {
      session.interactions.forEach(interaction => {
        try {
          this.maybeGenerateProposalFromInteraction(interaction);
        } catch (err) {
          // ignora falhas por item
        }
      });
    });
    this.saveToStorage();
  }

  /**
   * Extrai palavras-chave de um texto
   */
  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
      'é', 'são', 'está', 'estão', 'foi', 'foram',
      'e', 'ou', 'mas', 'porém', 'contudo',
      'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas',
      'para', 'por', 'com', 'sem', 'entre',
      'que', 'qual', 'quais', 'quanto', 'quantos',
      'como', 'onde', 'quando', 'por que',
    ]);

    return text
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 10);
  }

  /**
   * Encontra conhecimento relevante para as palavras-chave
   */
  private findRelevantKnowledge(keywords: string[]): KnowledgeEntry[] {
    const scored: Array<{ entry: KnowledgeEntry; score: number }> = [];

    this.knowledgeBase.forEach(entry => {
      let score = 0;
      const contentLower = (entry.content + ' ' + entry.topic).toLowerCase();

      keywords.forEach(keyword => {
        if (contentLower.includes(keyword)) {
          score += 1;
        }
      });

      entry.tags.forEach(tag => {
        if (keywords.includes(tag.toLowerCase())) {
          score += 2;
        }
      });

      if (score > 0) {
        score *= (entry.relevance / 50); // Multiplica pela relevância
        scored.push({ entry, score });
      }
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(item => item.entry);
  }

  /**
   * Gera uma resposta baseada no conhecimento disponível
   */
  private generateAnswer(
    question: string,
    relevantKnowledge: KnowledgeEntry[]
  ): string {
    if (relevantKnowledge.length === 0) {
      return `Desculpe, ainda não tenho conhecimento suficiente sobre "${question}". Você poderia me ensinar mais sobre este assunto? Use a opção de adicionar conhecimento para me ajudar a aprender.`;
    }

    const knowledge = relevantKnowledge[0];
    const additionalInfo = relevantKnowledge
      .slice(1)
      .map(k => `• ${k.content.substring(0, 100)}...`)
      .join('\n');

    let answer = `Com base no que aprendi sobre "${knowledge.topic}":\n\n${knowledge.content}`;

    if (additionalInfo) {
      answer += `\n\nInformações adicionais relacionadas:\n${additionalInfo}`;
    }

    answer += `\n\n(Confiança: ${Math.round((relevantKnowledge.length / 5) * 100)}%)`;

    return answer;
  }

  /**
   * Obtém estatísticas de aprendizado
   */
  getStats() {
    return {
      ...this.stats,
      knowledgeCount: this.knowledgeBase.size,
      sessionCount: this.sessions.size,
    };
  }

  /**
   * Obtém toda a base de conhecimento
   */
  getKnowledgeBase(): KnowledgeEntry[] {
    return Array.from(this.knowledgeBase.values())
      .sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Obtém uma sessão específica
   */
  getSession(sessionId: string): LearningSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Lista todas as sessões
   */
  getAllSessions(): LearningSession[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Exporta todos os dados
   */
  exportData() {
    return {
      knowledgeBase: Array.from(this.knowledgeBase.values()),
      sessions: Array.from(this.sessions.values()),
      stats: this.stats,
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Importa dados
   */
  importData(data: ReturnType<typeof this.exportData>): void {
    this.knowledgeBase.clear();
    this.sessions.clear();
    this.proposals.clear();

    data.knowledgeBase.forEach(entry => {
      this.knowledgeBase.set(entry.id, entry);
    });

    data.sessions.forEach(session => {
      this.sessions.set(session.id, session);
    });

    this.stats = data.stats;
    this.saveToStorage();
  }

  /**
   * Limpa todos os dados
   */
  clearAll(): void {
    this.knowledgeBase.clear();
    this.sessions.clear();
    this.stats = {
      totalInteractions: 0,
      totalLearned: 0,
      averageConfidence: 0,
    };
    this.proposals.clear();
    this.saveToStorage();
  }

  /**
   * Salva dados no localStorage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(
        STORAGE_KEYS.KNOWLEDGE_BASE,
        JSON.stringify(Array.from(this.knowledgeBase.values()))
      );
      localStorage.setItem(
        STORAGE_KEYS.LEARNING_SESSIONS,
        JSON.stringify(Array.from(this.sessions.values()))
      );
      localStorage.setItem(
        STORAGE_KEYS.STATS,
        JSON.stringify(this.stats)
      );
      localStorage.setItem(
        STORAGE_KEYS.PROPOSALS,
        JSON.stringify(Array.from(this.proposals.values()))
      );
      localStorage.setItem(
        STORAGE_KEYS.SETTINGS,
        JSON.stringify(this.settings)
      );
    } catch (error) {
      console.error('Erro ao salvar dados no localStorage:', error);
    }
  }

  /**
   * Carrega dados do localStorage
   */
  private loadFromStorage(): void {
    try {
      const knowledgeData = localStorage.getItem(STORAGE_KEYS.KNOWLEDGE_BASE);
      if (knowledgeData) {
        const entries: KnowledgeEntry[] = JSON.parse(knowledgeData);
        entries.forEach(entry => {
          this.knowledgeBase.set(entry.id, entry);
        });
      }

      const sessionsData = localStorage.getItem(STORAGE_KEYS.LEARNING_SESSIONS);
      if (sessionsData) {
        const sessions: LearningSession[] = JSON.parse(sessionsData);
        sessions.forEach(session => {
          this.sessions.set(session.id, session);
        });
      }

      const statsData = localStorage.getItem(STORAGE_KEYS.STATS);
      if (statsData) {
        this.stats = JSON.parse(statsData);
      }

      const proposalsData = localStorage.getItem(STORAGE_KEYS.PROPOSALS);
      if (proposalsData) {
        const proposals: LearningProposal[] = JSON.parse(proposalsData);
        proposals.forEach(p => this.proposals.set(p.id, p));
      }

      const settingsData = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (settingsData) {
        try {
          const s = JSON.parse(settingsData);
          this.settings = { ...this.settings, ...s };
        } catch {}
      }
    } catch (error) {
      console.error('Erro ao carregar dados do localStorage:', error);
    }
  }

  /**
   * Atualiza a confiança média
   */
  private updateAverageConfidence(): void {
    let totalConfidence = 0;
    let count = 0;

    this.sessions.forEach(session => {
      session.interactions.forEach(interaction => {
        totalConfidence += interaction.confidence;
        count++;
      });
    });

    this.stats.averageConfidence = count > 0 ? totalConfidence / count : 0;
  }
}

// Instância global
let engineInstance: AILearningEngine | null = null;

export function getAIEngine(): AILearningEngine {
  if (!engineInstance) {
    engineInstance = new AILearningEngine();
  }
  return engineInstance;
}

export function resetAIEngine(): void {
  engineInstance = null;
}

