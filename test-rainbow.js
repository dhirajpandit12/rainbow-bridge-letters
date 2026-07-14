require('dotenv').config();
process.env.IS_LOCAL = 'true';
const { generateLetter } = require('./src/services/rainbowLetter');
const { generatePdf } = require('./src/services/pdfGenerator');
const fs = require('fs');

const details = {
  petName: 'Princess',
  petType: 'Dog',
  ownerName: 'Maria',
  calledYou: 'Mom',
  personality: 'She was so loving and happy and she will go crazy when my kids and grandkids would come over.',
  favoriteMemory: 'How I will tell her princess night, night and she would run up the back stairs run into my room and jump on my bed and lay down to sleep. How she was always at the back door waiting for me to come home from work to greet me how I miss those days and her.',
  messageToPet: 'That I miss her so much and cry for her every day and night. And I am sorry that I didn\'t take her out for walks like I should have but I was always scared that she would be attacked by bigger dogs.',
};

async function main() {
  console.log('Generating letter...');
  const letter = await generateLetter(details);
  console.log('\n--- LETTER ---\n');
  console.log(letter);
  console.log('\n--- END ---\n');
  console.log('Word count:', letter.split(/\s+/).length);

  console.log('\nGenerating PDF...');
  const pdf = await generatePdf({ calledYou: details.calledYou, letterBody: letter, petName: details.petName });
  fs.writeFileSync('/Users/dhirajpandit/Desktop/rainbow-test.pdf', pdf);
  console.log('PDF saved to Desktop: rainbow-test.pdf');
}

main().catch(console.error);
