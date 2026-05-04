/**
 * 数组工具函数
 */

/**
 * 数组元素累加
 * @param {number[]} arr - 数字数组
 * @returns {number} 累加结果
 */
export function sum(arr) {
  if (!Array.isArray(arr)) {
    throw new Error('参数必须是数组');
  }
  return arr.reduce((total, current) => total + current, 0);
}
