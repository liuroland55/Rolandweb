// 所有标量都用 JSON.stringify 输出：合法的 JSON 字符串同时是合法的 YAML 双引号字符串，
// 引号、冒号、井号、换行都不用另外操心。/write 和 /admin 的新建相册卷都要拼 YAML frontmatter，
// 共用这一份，别各写一遍。
export function yamlStr(s: string): string {
  return JSON.stringify(s);
}
