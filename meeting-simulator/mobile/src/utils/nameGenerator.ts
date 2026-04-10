const ADJ = [
  'Sleepy',
  'Curious',
  'Clueless',
  'Brave',
  'Lazy',
  'Dramatic',
  'Sneaky',
  'Reckless',
  'Polite',
  'Grumpy',
  'Cheerful',
  'Confused',
  'Bold',
  'Gentle',
  'Chaotic',
  'Hungry',
];

const NOUN = [
  'Intern',
  'Diplomat',
  'Spy',
  'Accountant',
  'Witness',
  'Consultant',
  'Janitor',
  'CEO',
  'Penguin',
  'Lobster',
  'Toaster',
  'Astronaut',
  'Pirate',
  'Professor',
  'Detective',
  'Ghost',
];

function pick<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

export function generateNickname() {
  const r = Math.random();
  if (r < 0.1) return pick(NOUN);
  if (r < 0.2) return pick(ADJ);
  return `${pick(ADJ)} ${pick(NOUN)}`;
}
