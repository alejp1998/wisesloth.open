// Function to get the number of times each personality option was chosen
const getPersonalityCountFromHitsAndFails = (hits, fails) => {
  let scoreStr = hits.toString() + fails.toString();
  // console.log("Score string:", scoreStr);
  // Replace 9s in even positions with 0s
  // Convert the string to an array
  const scoreArray = scoreStr.split('');

  // Iterate over the array and replace 9s in even positions with 0s
  for (let i = 0; i < scoreArray.length; i++) {
    if (i % 2 === 0 && scoreArray[i] === '9') {
      scoreArray[i] = '0';
    }
  }

  // Convert the array back to a string
  scoreStr = scoreArray.join('');
  // console.log("Score string:", scoreStr);
  const personalitiesCount = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  // Split the score string of 12 chars into 6 pairs of 2 chars
  const pairs = scoreStr.match(/.{1,2}/g);

  // Turn each pair into a number, and assign the first pair to personalitiesCount[1]
  // and the last pair to personalitiesCount[6]
  for (let i = 0; i < pairs.length; i++) {
    personalitiesCount[i + 1] = parseInt(pairs[i]);
  }

  // Order the keys in personalitiesCount by number of times chosen
  const orderedPersonalities = Object.keys(personalitiesCount).sort((a, b) => personalitiesCount[b] - personalitiesCount[a]);

  return [personalitiesCount, orderedPersonalities];
};

exports.getPersonalityCountFromHitsAndFails = getPersonalityCountFromHitsAndFails;
