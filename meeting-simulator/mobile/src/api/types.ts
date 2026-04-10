export type FeedItem = {
  feedItemId: string;
  roomId: string;
  newsTitle: string;
  npcAName: string;
  npcAReaction: string;
  npcBName: string;
  npcBReaction: string;
  newsTitleEn?: string;
  npcAReactionEn?: string;
  npcBReactionEn?: string;
  tags: string[];
  difficulty: string;
  bgColor: string;
  likes: number;
  commentCount: number;
};

export type NpcProfile = {
  id: string;
  name: string;
  gender?: string;
  voiceId?: string;
  persona?: string;
};

export type DialogueTurn =
  | { type: 'npc'; speaker: string; text: string; textZh?: string }
  | { type: 'user_cue'; speaker: string; hint?: string; hintZh?: string; options?: Array<{ label: string; example: string }> }
  | { type: 'system'; text: string };

export type JoinChatResponse = {
  chatSessionId: string;
  groupName: string;
  groupNotice?: string | null;
  userRoleName: string;
  userRoleNameEn?: string | null;
  userRoleDesc?: string | null;
  npcProfiles: NpcProfile[];
  dialogueScript: DialogueTurn[];
  totalUserTurns: number;
};

export type ChatReply = {
  speaker: string;
  text: string;
  textZh?: string;
  emotion?: 'happy' | 'angry' | 'sad' | 'neutral';
  voiceId?: string;
};

export type RespondChatResponse = {
  messageId: number;
  npcReply: ChatReply;
  betterVersion?: string | null;
  feedbackType?: string | null;
  learningType?: 'pattern' | 'collocations' | null;
  pattern?: string | null;
  collocations?: Array<{ phrase: string; meaning: string }> | null;
  highlights?: string[] | null;
  isLastTurn: boolean;
};

export type SettlementResponse = {
  newsletter: {
    publisher: string;
    ipName?: string;
    headline: string;
    epilogue: string[] | string;
    title: string;
  };
  stats: {
    duration: string;
    wordCount: number;
  };
  expressionCards: Array<{
    id: number;
    turnIndex: number;
    userSaid: string;
    feedbackType?: string | null;
    betterVersion: string;
    learningType?: 'pattern' | 'collocations' | null;
    pattern?: string | null;
    collocations?: Array<{ phrase: string; meaning: string }> | null;
    highlights?: string[];
    isFeatured: boolean;
    isSaved: boolean;
  }>;
};

export type ExpressionListResponse = {
  cards: Array<{
    id: number;
    userSaid: string;
    betterVersion: string;
    contextNote?: string | null;
    isSaved: boolean;
    isPracticed: boolean;
    savedAt: string;
  }>;
  stats?: {
    total: number;
    savedCount: number;
    practicedCount: number;
  };
};

export type UserStats = {
  chatCount: number;
  messageCount: number;
  savedCount: number;
};
