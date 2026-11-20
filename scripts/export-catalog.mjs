import {writeFileSync} from 'node:fs';
import {questions,categories,CATALOG_VERSION} from '../shared/questions.js';
if(questions.length!==667||new Set(questions.map(q=>q.text)).size!==667)throw Error('Catalogue must contain 667 unique questions');
writeFileSync(new URL('../shared/catalog.json',import.meta.url),JSON.stringify({questions,categories}));
console.log(`Catalogue v${CATALOG_VERSION}: ${questions.length} questions, ${categories.length} categories`);
