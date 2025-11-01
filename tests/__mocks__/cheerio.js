/**
 * Cheerio mock for Jest
 */

const cheerioMock = {
  load: jest.fn((html) => {
    const $ = jest.fn((selector) => {
      if (selector === 'table tbody tr') {
        const rows = [];
        const tableMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
        if (tableMatch) {
          const rowMatches = tableMatch[1].match(/<tr>([\s\S]*?)<\/tr>/g) || [];
          rowMatches.forEach((rowHtml) => {
            rows.push({
              find: jest.fn((cellSelector) => {
                if (cellSelector === 'td') {
                  const cells = rowHtml.match(/<td>(.*?)<\/td>/g) || [];
                  return cells.map((cell, index) => ({
                    text: jest.fn(() => cell.replace(/<\/?td>/g, '').trim()),
                    length: cells.length,
                    [index]: {
                      text: jest.fn(() => cell.replace(/<\/?td>/g, '').trim())
                    }
                  }));
                }
                return [];
              })
            });
          });
        }
        return {
          each: jest.fn((callback) => {
            rows.forEach((row, index) => callback(index, row));
          }),
          length: rows.length
        };
      }
      return {
        find: jest.fn(() => ({
          text: jest.fn(() => ''),
          length: 0
        })),
        text: jest.fn(() => ''),
        length: 0
      };
    });

    $.fn = $;
    return $;
  })
};

module.exports = cheerioMock;
