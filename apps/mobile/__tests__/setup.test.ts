/**
 * Simple test to verify Jest setup is working correctly
 */
describe("Jest Setup", () => {
  it("should run tests successfully", () => {
    expect(true).toBe(true);
  });

  it("should perform basic math operations", () => {
    expect(2 + 2).toBe(4);
    expect(10 - 5).toBe(5);
    expect(3 * 4).toBe(12);
  });

  it("should handle string operations", () => {
    const greeting = "Hello, Jest!";
    expect(greeting).toContain("Jest");
    expect(greeting.length).toBeGreaterThan(0);
  });

  it("should handle array operations", () => {
    const numbers = [1, 2, 3, 4, 5];
    expect(numbers).toHaveLength(5);
    expect(numbers).toContain(3);
  });
});
