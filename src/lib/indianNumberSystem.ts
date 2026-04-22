/**
 * Converts a number into words using the Indian Numbering System (Lakhs, Crores).
 */
export function numberToIndianWords(num: number): string {
  if (num === 0) return 'Zero';

  const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teenDigits = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const doubleDigits = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertSmall(n: number): string {
    let str = "";
    if (n >= 100) {
      str += singleDigits[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 20) {
      str += doubleDigits[Math.floor(n / 10)] + " ";
      n %= 10;
    }
    if (n >= 10) {
      str += teenDigits[n - 10] + " ";
      n = 0;
    }
    if (n > 0) {
      str += singleDigits[n] + " ";
    }
    return str.trim();
  }

  // Handle decimal part (Paise)
  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  let result = "";

  const crore = Math.floor(integerPart / 10000000);
  const lakh = Math.floor((integerPart % 10000000) / 100000);
  const thousand = Math.floor((integerPart % 100000) / 1000);
  const remainder = Math.floor(integerPart % 1000);

  if (crore > 0) {
    result += convertSmall(crore) + " Crore ";
  }
  if (lakh > 0) {
    result += convertSmall(lakh) + " Lakh ";
  }
  if (thousand > 0) {
    result += convertSmall(thousand) + " Thousand ";
  }
  if (remainder > 0) {
    result += convertSmall(remainder) + " ";
  }

  result = result.trim();
  
  if (decimalPart > 0) {
    return `${result} Rupees and ${convertSmall(decimalPart)} Paise Only`;
  }
  
  return `${result} Rupees Only`;
}
