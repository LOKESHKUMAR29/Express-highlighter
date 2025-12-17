const fs = require("fs").promises;
const path = require("path");

let WORD_DATA_MAP = new Map();
let TRIE_ROOT = null;

class TrieNode {
  constructor() {
    this.children = new Map();
    this.isWord = false;
    this.word = null;
  }
}

function buildTrie(words) {
  const root = new TrieNode();
  words.forEach((word) => {
    let node = root;
    for (const char of word.toLowerCase()) {
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode());
      }
      node = node.children.get(char);
    }
    node.isWord = true;
    node.word = word.toLowerCase();
  });
  return root;
}

function isWordChar(ch) {
  return /\p{L}|\p{N}/u.test(ch);
}

function findWordsInText(text, trie) {
  const matches = [];
  const lowerText = text.toLowerCase();
  const len = lowerText.length;

  for (let i = 0; i < len; i++) {
    if (i > 0 && isWordChar(lowerText[i - 1])) continue;

    let node = trie;
    let j = i;

    while (j < len && node.children.has(lowerText[j])) {
      node = node.children.get(lowerText[j++]);
      if (node.isWord && (j >= len || !isWordChar(lowerText[j]))) {
        matches.push({
          word: text.substring(i, j),
          start: i,
          end: j,
          key: node.word,
        });
      }
    }
  }
  return matches;
}

async function loadSkillsData() {
  if (TRIE_ROOT) return; // Data already loaded

  try {
    const dataPath = path.join(__dirname, "..", "..", "data", "skills-output.json");
    const rawData = await fs.readFile(dataPath, "utf-8");
    const skills = JSON.parse(rawData);

    skills.forEach((item) => {
      if (item.name) {
        WORD_DATA_MAP.set(item.name.toLowerCase(), item);
      }
    });

    TRIE_ROOT = buildTrie([...WORD_DATA_MAP.keys()]);
    console.log(`[SkillsMatcher] Loaded ${WORD_DATA_MAP.size} skills.`);
  } catch (error) {
    console.error("[SkillsMatcher] Failed to load skills data:", error);
    throw error;
  }
}

/**
 * Finds skill matches in a single large text (e.g. PDF content).
 * Returns array of enriched match objects.
 */
function findMatchesInText(text) {
    if (!TRIE_ROOT) return [];
    
    const matches = findWordsInText(text, TRIE_ROOT);
    
    // Deduplicate matches based on the skill key (word)
    // For PDF/Analysis use cases, we often want unique skills found
    const uniqueSkills = new Map();
    
    matches.forEach((match) => {
      if (!uniqueSkills.has(match.key)) {
        const skillData = WORD_DATA_MAP.get(match.key);
        if (skillData) {
          uniqueSkills.set(match.key, {
            name: skillData.name,
            description: skillData.description,
            skillType: skillData.skillType,
            // Keep original match info if needed, but for "unique list" we mostly need metadata
          });
        }
      }
    });
    
    return Array.from(uniqueSkills.values());
}

/**
 * Finds matches in a batch of text snippets (for HTML highlighting).
 * Returns array of match arrays, maintaining 1:1 index correspondence.
 */
function findMatchesInTextBatch(texts) {
    if (!TRIE_ROOT) {
        return texts.map(() => []);
    }

    return texts.map(text => {
        const matches = findWordsInText(text, TRIE_ROOT);
        // Returns all occurrences for highlighting (not deduplicated)
        return matches.map(m => {
             const data = WORD_DATA_MAP.get(m.key);
             return {
                 ...m,
                 data: data
             };
        });
    });
}

module.exports = {
  loadSkillsData,
  findMatchesInText,
  findMatchesInTextBatch
};
