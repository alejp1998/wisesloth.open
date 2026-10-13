const urlm = require('url');

/**
 * Adds a page number parameter to a URL.
 * If `_param_name` is not provided, it defaults to "pageno."
 *
 * @param {string} url - The URL to which to add the page number parameter.
 * @param {number} pageno - The page number to add to the URL.
 * @param {string} [_param_name] - The name of the page number parameter (optional).
 * @returns {string} - The modified URL with the page number parameter.
 */
const addPagenoToUrl = (url, pageno, _param_name) => {
  const param_name = _param_name ? _param_name : 'pageno';
  const urlObj = urlm.parse(url, true);

  urlObj.query[param_name] = pageno;

  delete urlObj.search;

  return urlm.format(urlObj);
};

/* Build pagination link */
const genPageLink = (url, pageno, classNames) => {
  const pagenoHTML = classNames.includes('marked') ? '<b>' + pageno + '</b>' : pageno;
  url = addPagenoToUrl(url, pageno);
  return '<a class="' + classNames + '" href="' + url + '" data-pageno="' + pageno + '"> ' + pagenoHTML + ' </a>';
};

/* Build pagination-button div element */
const genPageButton = (url, pageno, classNames) => {
  const pagenoHTML = classNames.includes('marked') ? '<b>' + pageno + '</b>' : pageno;
  classNames += ' pagination-button';
  return '<div class="' + classNames + '" data-pageno="' + pageno + '"> ' + pagenoHTML + ' </div>';
};

/**
 * Helper function used for pagination.
 * Returns the HTML links used for pagination.
 *
 * @param {number} totalItems - The total number of items to paginate.
 * @param {number} itemsPerPage - The number of items displayed per page.
 * @param {number} currentPage - The current page number.
 * @param {string} url - The base URL for pagination links.
 * @param {boolean} [is_redirect=false] - Whether to use links or buttons for pagination.
 * @returns {string|boolean} - The HTML links for pagination or `false` if there's only one page.
 */
const paginate = (totalItems, itemsPerPage, currentPage, url, is_redirect = false) => {
  if (totalItems <= itemsPerPage) {
    return false;
  }
  const classNames = 'flex-item-quiz-link';
  const total = Math.ceil(totalItems / itemsPerPage);
  const genPageEl = is_redirect ? genPageLink : genPageButton;

  // Number of links to show before and after the current page.
  // In addition to these, the first, last and intermediate links are also shown
  let neighbours = 2; // number of items to show around the current page

  const html = [];

  // Modify neighbors to avoid having too few buttons:
  //  - If there is no space for the neighbors on the left, show more on the right.
  //  - If there is no space for the neighbors on the right, show more on the left.
  if (currentPage - neighbours <= 2) {
    neighbours += 3 + neighbours - currentPage;
  } else if (total - currentPage - neighbours <= 1) {
    neighbours += 2 - total + currentPage + neighbours;
  }

  // First page
  if (1 < currentPage - neighbours) {
    html.push(genPageEl(url, 1, classNames));
  }

  // Previous pages: between the first page and the middle pages
  if (currentPage - neighbours > 2) {
    const n = Math.trunc((1 + currentPage - neighbours) / 2);
    html.push(genPageEl(url, n, classNames));
  }

  // Pages in the middle
  for (let i = 1; i <= total; i++) {
    if (i === currentPage) {
      html.push(genPageEl(url, i, classNames + ' marked'));
    } else {
      if (i >= currentPage - neighbours && i <= currentPage + neighbours) {
        html.push(genPageEl(url, i, classNames));
      }
    }
  }

  // Next pages: between the middle pages and the last page
  if (currentPage + neighbours < total - 1) {
    const n = Math.trunc((total + currentPage + neighbours + 1) / 2);
    html.push(genPageEl(url, n, classNames));
  }

  // Last page
  if (total > currentPage + neighbours) {
    html.push(genPageEl(url, total, classNames));
  }

  return html.join('');
};

exports.addPagenoToUrl = addPagenoToUrl;
exports.paginate = paginate;
