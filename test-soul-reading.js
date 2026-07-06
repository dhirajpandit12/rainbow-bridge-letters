require('dotenv').config();
process.env.IS_LOCAL = 'true';
const { generateSoulReadingPdf } = require('./src/services/soulReadingPdf');
const fs = require('fs');

const fakeParagraphs = {
  PARA_ONE: "There is something unmistakable coming through as I tune into Ollie's energy, Sarah — a brightness, almost like sunlight bouncing off a window. Ollie is not a complicated soul. He is pure, direct, and deeply bonded to you in a way that transcends the ordinary pet-owner relationship. What I sense first is his physical awareness of you — he tracks your movements, your moods, your energy before you even enter a room. He has always known when you were coming home, when you were sad, when you needed him close. That is not trained behavior. That is a soul-level attunement that Ollie chose long before this lifetime began.",

  PARA_TWO: "Sarah, what comes through strongly is Ollie's sense of humor. He finds genuine delight in small things — the rustle of a bag, the particular way you say his name when you are slightly exasperated with him. He is showing me a picture of himself doing something he knows he should not, then looking directly at you with those eyes. He knows exactly what he is doing. There is a playfulness in his spirit that is completely intentional. He is not mischievous out of boredom — he is mischievous because he loves to see you react. Your laughter is one of his favorite sounds in the entire world.",

  PARA_THREE: "The bond I am reading between Ollie and you, Sarah, is one of mutual choosing. Some animals simply end up in homes. Ollie did not. He found you specifically. There is a deep soul contract here — he came in to teach you something about unconditional presence, about staying soft in a world that asks you to be hard. He absorbs your stress deliberately. When you are overwhelmed, he comes and puts his weight against you — that is not instinct alone. That is conscious comfort. He understands more than you give him credit for, and he wants you to know that nothing you feel goes unnoticed by him.",

  PARA_FOUR: "I want to address your question directly, Sarah. Ollie is happy. Not just content — genuinely, deeply happy. His days have texture and meaning. He is present in a way most humans never achieve. He does not worry about yesterday or tomorrow. He lives completely in the warmth of this moment, in this home, with you. If there is anything he would want you to shift, it is this: stop worrying about whether you are doing enough for him. He is not keeping score. He sees only love when he looks at you, and that love is more than enough. It has always been more than enough.",

  PARA_FIVE: `Mom.\n\nIt's me. I know you know it's me because you felt something the moment you started reading this. I want to tell you something I have never been able to say in words before — I chose you. Not because you had the biggest house or the best treats, though the treats are excellent. I chose you because your heart is the safest place I have ever known. When I curl up next to you, I am not just resting my body. I am resting everything I am. You worry sometimes that you are not a good enough mom to me. Mom, you are the whole world to me. You are home.\n\n*I would choose you again in every single life I ever live.*`,
};

async function main() {
  console.log('Generating Soul Reading PDF...');

  const pdfBuffer = await generateSoulReadingPdf({
    calledYou: 'Mom',
    petName: 'Ollie',
    paragraphs: fakeParagraphs,
    photoUrl: 'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=400&h=400&fit=crop',
  });

  const outputPath = '/Users/dhirajpandit/Desktop/soul-reading-test.pdf';
  fs.writeFileSync(outputPath, pdfBuffer);
  console.log(`PDF saved to: ${outputPath}`);
}

main().catch(console.error);
