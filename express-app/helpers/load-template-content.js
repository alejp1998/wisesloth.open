// REQUIRES
const fs = require('fs');
const ejs = require('ejs');

// Import formatTimeLeft and formatTimeAgo functions


// MAIN TEMPLATES
// Main template paths
const templatePaths = {
  'home': 'views/general/home.ejs',
  'community': 'views/general/community.ejs',
  'about': 'views/general/about.ejs',
  'help': 'views/general/help.ejs',
  'tips': 'views/general/tips.ejs',
  'faq': 'views/general/faq.ejs',
  'error': 'views/error.ejs',
  'login-required': 'views/login-required.ejs',
  'privacy-policy': 'views/general/privacy-policy.ejs',
  'terms-of-use': 'views/general/terms-of-use.ejs',
  'test-index': 'views/tests/index.ejs',
  'test-show': 'views/tests/show.ejs',
  'test-edit': 'views/tests/edit.ejs',
  'test-try': 'views/tests/try.ejs',
  'test-new': 'views/tests/new.ejs',
  'flashcards-show': 'views/tests/flashcards.ejs',
  'flashcards-edit': 'views/tests/edit-flashcards.ejs',
  'result-index': 'views/results/index.ejs',
  'result-show': 'views/results/show.ejs',
  'user-index': 'views/users/index.ejs',
  'user-show': 'views/users/show.ejs',
  'from-old-exam': 'views/general/from-old-exam.ejs',
  'from-notes-or-text': 'views/general/from-notes-or-text.ejs',
  'from-instructions': 'views/general/from-instructions.ejs',
  'from-flashcards': 'views/general/from-flashcards.ejs',
  'user-card': 'views/cards/user.ejs',
  'test-card': 'views/cards/test.ejs',
  'test-not-found': 'views/tests/test-not-found.ejs',
  'user-not-found': 'views/users/user-not-found.ejs',
  'result-not-found': 'views/results/result-not-found.ejs',
  'livebattle-lobby': 'views/livebattle/lobby.ejs',
  'livebattle-not-found': 'views/livebattle/livebattle-not-found.ejs',
};

// AUXILIARY TEMPLATES
// Auxiliary template paths
const auxiliaryTemplatePaths = [
  'views/cards/test.ejs',
  'views/cards/user.ejs',
  'views/cards/grouped-result.ejs',
  'views/cards/result.ejs',
  'views/auxiliary/hero-header.ejs',
  'views/auxiliary/test-control-panel.ejs',
  'views/auxiliary/test-quiz.ejs',
  'views/auxiliary/chart.ejs',
  'views/auxiliary/test-tables.ejs',
  'views/auxiliary/test-tables-personality.ejs',
  'views/auxiliary/modal-context.ejs',
  'views/auxiliary/modal-edit-test.ejs',
  'views/auxiliary/general-ai-edit.ejs',
  'views/auxiliary/quiz-edit-example.ejs',
  'views/auxiliary/modal-edit-quiz.ejs',
  'views/auxiliary/modal-edit-quiz-inline.ejs',
  'views/auxiliary/modal-skills.ejs',
  'views/auxiliary/stopwatch.ejs',
  'views/general/from-old-exam.ejs',
  'views/general/from-notes-or-text.ejs',
  'views/general/from-instructions.ejs',
  'views/general/from-flashcards.ejs'
];

// Load auxiliary templates from the file system
const auxiliaryTemplates = {};
for (const auxiliaryTemplatePath of auxiliaryTemplatePaths) {
  const auxiliaryTemplateKey = auxiliaryTemplatePath.split('/').pop().split('.').shift();
  // console.log("Auxiliary template key: ", auxiliaryTemplateKey);
  auxiliaryTemplates[auxiliaryTemplateKey] = fs.readFileSync(auxiliaryTemplatePath, 'utf-8');
}

// Remove all html comments from the content
function removeHtmlComments(content) {
  content = content.replace(/<!--[\s\S]*?-->/g, '');
  return content;
}

// Function to find the line where the key is found and replace it with the auxiliary template
function findAndReplaceAuxiliaryTemplate(content, auxiliaryTemplateKey, auxiliaryTemplate, startIndex = 0) {
  // Get the start and end index of the line that matches the auxiliary template
  const strToFind = auxiliaryTemplateKey + '\'';
  startIndex = content.indexOf(strToFind, startIndex);
  let startLineIndex = content.lastIndexOf('\n', startIndex) + 1;
  let endLineIndex = content.indexOf('\n', startIndex);

  // Ensure the line contains the word "include"
  let lineIncludesInclude = content.slice(startLineIndex, endLineIndex).includes('include');
  // console.log("Line: ", line);
  while (!lineIncludesInclude) {
    // Find the next occurrence of the auxiliary template key
    startIndex = content.indexOf(strToFind, endLineIndex);

    // If there is no next occurrence, break the loop
    if (startIndex === -1) {
      // console.log("No more occurrences of [", strToFind, "] in the content.");
      return content;
    }

    // Update the start and end line indexes
    startLineIndex = content.lastIndexOf('\n', startIndex) + 1;
    endLineIndex = content.indexOf('\n', startIndex);

    // Update the line
    lineIncludesInclude = content.slice(startLineIndex, endLineIndex).includes('include');
    // console.log("Line: ", line);
  }

  // Insert the auxiliary template into the content
  // console.log("Inserting { " + auxiliaryTemplateKey + " } replacing line : " + line);
  content = content.slice(0, startLineIndex) + auxiliaryTemplate + content.slice(endLineIndex);

  // Set the new start line index after the auxiliary template
  const newStartIndex = startLineIndex + auxiliaryTemplate.length;

  // Check if the content still includes the auxiliary template
  while (content.slice(newStartIndex).includes(strToFind)) {
    // console.log("[", strToFind, "] appears more than once in the content.");
    content = findAndReplaceAuxiliaryTemplate(content, auxiliaryTemplateKey, auxiliaryTemplate, newStartIndex);
  }

  return content;
}

// Insert auxiliary templates into content
function insertAuxiliaryTemplatesIntoContent(content) {
  for (const [auxiliaryTemplateKey, auxiliaryTemplate] of Object.entries(auxiliaryTemplates)) {
    // Check if there is a line in the content that matches the auxiliary template
    if (content.includes(auxiliaryTemplateKey)) {
      content = findAndReplaceAuxiliaryTemplate(content, auxiliaryTemplateKey, auxiliaryTemplate);
    }
  }

  return content;
}

// Load template content
function loadTemplateContent(templateKey) {
  // Get the template path
  const templatePath = templatePaths[templateKey];
  if (!templatePath) throw new Error('Template key not found: ' + templateKey);

  // Load the template content
  let templateContent = fs.readFileSync(templatePath, 'utf-8');

  // Insert auxiliary templates into the content
  templateContent = insertAuxiliaryTemplatesIntoContent(templateContent);

  // Remove all html comments from the content
  templateContent = removeHtmlComments(templateContent);

  return templateContent;
}

// Build template data object
function buildTemplateDataObject(resLocals, data) {
  // Check if data is an object
  if (typeof data !== 'object') {
    data = {};
  }

  // Build the template data object
  const templateData = {
    ...resLocals, // Add locals
    ...data, // Add data
  };

  return templateData;
}

// Function to render template
function getRenderedTemplate(templateContent, resLocals, data = {}) {
  // Check if the user is logged in
  let isLoggedInHTML = '';
  if (resLocals.session.user) {
    // If the user is logged in, add the user data to the template
    isLoggedInHTML = `<div id="is-logged-in-html" class="is-hidden"
      data-is-logged-in="true"
      data-username="${resLocals.session.user.username}"
      data-is-admin="${resLocals.session.user.isAdmin}">
    </div>`;
  } else {
    isLoggedInHTML = `<div id="is-logged-in-html" class="is-hidden"
    data-is-logged-in="false"
    data-username=""
    data-is-admin="false">
  </div>`;
  }

  // Build the template data object
  const templateData = buildTemplateDataObject(resLocals, data);
  // Render the template
  try {
    const renderedHTML = ejs.render(templateContent, templateData);
    return isLoggedInHTML + '\n' + renderedHTML;
  } catch (error) {
    // console.log(templateContent);
    console.error('Error rendering EJS template:', error);
    throw new Error('Error rendering EJS template: ' + error);
  }
}

// Export the function to load the template contents
exports.loadTemplateContent = loadTemplateContent;

// Export the function to get the rendered template
exports.getRenderedTemplate = getRenderedTemplate;
