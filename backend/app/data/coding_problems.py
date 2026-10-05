"""Curated coding-interview problems for in-browser practice.

Every problem has a reference Python solution; `tests/test_coding.py` runs each reference solution
against every test case, so the expected outputs here are verified in CI.

`compare`: "exact" (deep equality, floats within 1e-6), "unordered" (list order ignored) or
"groups" (list of lists; order ignored at both levels).
"""

from __future__ import annotations


def _t(args: list, expected, hidden: bool = False) -> dict:
    return {"args": args, "expected": expected, "hidden": hidden}


PROBLEMS: list[dict] = [
    # ------------------------------------------------------------------ easy
    {
        "slug": "two-sum",
        "title": "Two Sum",
        "difficulty": "easy",
        "topics": ["Arrays", "Hashing"],
        "statement": "Given a list of integers `nums` and an integer `target`, return the indices of the two "
                     "numbers that add up to `target`, in increasing order. Exactly one answer exists, and "
                     "you may not use the same element twice.",
        "constraints": ["2 ≤ len(nums) ≤ 10⁴", "-10⁹ ≤ nums[i], target ≤ 10⁹", "Aim for O(n) time"],
        "python": "def two_sum(nums: list[int], target: int) -> list[int]:",
        "js": "function twoSum(nums, target) {",
        "compare": "exact",
        "tests": [_t([[2, 7, 11, 15], 9], [0, 1]), _t([[3, 2, 4], 6], [1, 2]), _t([[3, 3], 6], [0, 1]),
                  _t([[-1, -2, -3, -4, -5], -8], [2, 4], True), _t([[0, 4, 3, 0], 0], [0, 3], True),
                  _t([[1, 5, 9, 14, 20], 23], [2, 3], True)],
        "reference": '''
def two_sum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        if target - n in seen:
            return [seen[target - n], i]
        seen[n] = i
''',
    },
    {
        "slug": "valid-parentheses",
        "title": "Valid Parentheses",
        "difficulty": "easy",
        "topics": ["Stack", "Strings"],
        "statement": "Given a string `s` containing only the characters ()[]{}, return true if every bracket "
                     "is closed by the same type of bracket in the correct order.",
        "constraints": ["0 ≤ len(s) ≤ 10⁴"],
        "python": "def is_valid(s: str) -> bool:",
        "js": "function isValid(s) {",
        "compare": "exact",
        "tests": [_t(["()"], True), _t(["()[]{}"], True), _t(["(]"], False), _t(["([)]"], False, True),
                  _t(["{[]}"], True, True), _t([""], True, True), _t(["(("], False, True), _t(["){"], False, True)],
        "reference": '''
def is_valid(s):
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    for c in s:
        if c in pairs:
            if not stack or stack.pop() != pairs[c]:
                return False
        else:
            stack.append(c)
    return not stack
''',
    },
    {
        "slug": "best-time-to-buy-and-sell-stock",
        "title": "Best Time to Buy and Sell Stock",
        "difficulty": "easy",
        "topics": ["Arrays", "Greedy"],
        "statement": "`prices[i]` is a stock's price on day i. Choose one day to buy and a later day to sell. "
                     "Return the maximum profit, or 0 if no profit is possible.",
        "constraints": ["1 ≤ len(prices) ≤ 10⁵", "0 ≤ prices[i] ≤ 10⁴"],
        "python": "def max_profit(prices: list[int]) -> int:",
        "js": "function maxProfit(prices) {",
        "compare": "exact",
        "tests": [_t([[7, 1, 5, 3, 6, 4]], 5), _t([[7, 6, 4, 3, 1]], 0), _t([[2, 4, 1]], 2, True),
                  _t([[1]], 0, True), _t([[3, 3, 5, 0, 0, 3, 1, 4]], 4, True)],
        "reference": '''
def max_profit(prices):
    best, low = 0, float("inf")
    for p in prices:
        low = min(low, p)
        best = max(best, p - low)
    return best
''',
    },
    {
        "slug": "valid-anagram",
        "title": "Valid Anagram",
        "difficulty": "easy",
        "topics": ["Hashing", "Strings"],
        "statement": "Return true if string `t` is an anagram of string `s` (same letters, same counts).",
        "constraints": ["1 ≤ len(s), len(t) ≤ 5·10⁴", "Lowercase English letters"],
        "python": "def is_anagram(s: str, t: str) -> bool:",
        "js": "function isAnagram(s, t) {",
        "compare": "exact",
        "tests": [_t(["anagram", "nagaram"], True), _t(["rat", "car"], False), _t(["a", "ab"], False, True),
                  _t(["listen", "silent"], True, True), _t(["aacc", "ccac"], False, True)],
        "reference": '''
def is_anagram(s, t):
    from collections import Counter
    return Counter(s) == Counter(t)
''',
    },
    {
        "slug": "missing-number",
        "title": "Missing Number",
        "difficulty": "easy",
        "topics": ["Arrays", "Math"],
        "statement": "`nums` contains n distinct numbers from the range 0..n. Return the one number in the "
                     "range that is missing.",
        "constraints": ["1 ≤ n ≤ 10⁴", "Aim for O(1) extra space"],
        "python": "def missing_number(nums: list[int]) -> int:",
        "js": "function missingNumber(nums) {",
        "compare": "exact",
        "tests": [_t([[3, 0, 1]], 2), _t([[0, 1]], 2), _t([[9, 6, 4, 2, 3, 5, 7, 0, 1]], 8, True),
                  _t([[1]], 0, True), _t([[0]], 1, True)],
        "reference": '''
def missing_number(nums):
    n = len(nums)
    return n * (n + 1) // 2 - sum(nums)
''',
    },
    {
        "slug": "valid-palindrome",
        "title": "Valid Palindrome",
        "difficulty": "easy",
        "topics": ["Two pointers", "Strings"],
        "statement": "Return true if `s` reads the same forwards and backwards after lower-casing it and "
                     "removing every character that is not a letter or digit.",
        "constraints": ["1 ≤ len(s) ≤ 2·10⁵"],
        "python": "def is_palindrome(s: str) -> bool:",
        "js": "function isPalindrome(s) {",
        "compare": "exact",
        "tests": [_t(["A man, a plan, a canal: Panama"], True), _t(["race a car"], False), _t([" "], True, True),
                  _t(["0P"], False, True), _t(["No 'x' in Nixon"], True, True)],
        "reference": '''
def is_palindrome(s):
    clean = [c.lower() for c in s if c.isalnum()]
    return clean == clean[::-1]
''',
    },
    {
        "slug": "merge-sorted-lists",
        "title": "Merge Two Sorted Lists",
        "difficulty": "easy",
        "topics": ["Two pointers", "Arrays"],
        "statement": "Given two lists sorted in non-decreasing order, return one sorted list containing all "
                     "their elements. Do it in O(n + m) without calling a sort function.",
        "constraints": ["0 ≤ len(a), len(b) ≤ 10⁴"],
        "python": "def merge_sorted(a: list[int], b: list[int]) -> list[int]:",
        "js": "function mergeSorted(a, b) {",
        "compare": "exact",
        "tests": [_t([[1, 2, 4], [1, 3, 4]], [1, 1, 2, 3, 4, 4]), _t([[], []], []), _t([[], [0]], [0], True),
                  _t([[-5, 3, 9], [-6, 10]], [-6, -5, 3, 9, 10], True)],
        "reference": '''
def merge_sorted(a, b):
    i = j = 0
    out = []
    while i < len(a) and j < len(b):
        if a[i] <= b[j]:
            out.append(a[i]); i += 1
        else:
            out.append(b[j]); j += 1
    return out + a[i:] + b[j:]
''',
    },
    {
        "slug": "first-unique-character",
        "title": "First Unique Character",
        "difficulty": "easy",
        "topics": ["Hashing", "Strings"],
        "statement": "Return the index of the first character in `s` that appears exactly once, or -1 if "
                     "there is none.",
        "constraints": ["1 ≤ len(s) ≤ 10⁵", "Lowercase English letters"],
        "python": "def first_unique(s: str) -> int:",
        "js": "function firstUnique(s) {",
        "compare": "exact",
        "tests": [_t(["leetcode"], 0), _t(["loveleetcode"], 2), _t(["aabb"], -1, True), _t(["z"], 0, True),
                  _t(["aadadaad"], -1, True)],
        "reference": '''
def first_unique(s):
    from collections import Counter
    counts = Counter(s)
    for i, c in enumerate(s):
        if counts[c] == 1:
            return i
    return -1
''',
    },
    # ------------------------------------------------------------------ medium
    {
        "slug": "longest-substring-without-repeating",
        "title": "Longest Substring Without Repeating Characters",
        "difficulty": "medium",
        "topics": ["Sliding window", "Hashing"],
        "statement": "Return the length of the longest substring of `s` that has no repeated characters.",
        "constraints": ["0 ≤ len(s) ≤ 5·10⁴"],
        "python": "def length_of_longest_substring(s: str) -> int:",
        "js": "function lengthOfLongestSubstring(s) {",
        "compare": "exact",
        "tests": [_t(["abcabcbb"], 3), _t(["bbbbb"], 1), _t(["pwwkew"], 3), _t([""], 0, True),
                  _t(["dvdf"], 3, True), _t(["abba"], 2, True), _t([" "], 1, True)],
        "reference": '''
def length_of_longest_substring(s):
    last, start, best = {}, 0, 0
    for i, c in enumerate(s):
        if c in last and last[c] >= start:
            start = last[c] + 1
        last[c] = i
        best = max(best, i - start + 1)
    return best
''',
    },
    {
        "slug": "group-anagrams",
        "title": "Group Anagrams",
        "difficulty": "medium",
        "topics": ["Hashing", "Strings"],
        "statement": "Group the words that are anagrams of each other. Return the groups in any order.",
        "constraints": ["1 ≤ len(words) ≤ 10⁴", "Lowercase English letters"],
        "python": "def group_anagrams(words: list[str]) -> list[list[str]]:",
        "js": "function groupAnagrams(words) {",
        "compare": "groups",
        "tests": [_t([["eat", "tea", "tan", "ate", "nat", "bat"]], [["bat"], ["nat", "tan"], ["ate", "eat", "tea"]]),
                  _t([[""]], [[""]]), _t([["a"]], [["a"]], True),
                  _t([["abc", "bca", "cab", "xyz", "zyx", "q"]], [["abc", "bca", "cab"], ["xyz", "zyx"], ["q"]], True)],
        "reference": '''
def group_anagrams(words):
    groups = {}
    for w in words:
        groups.setdefault("".join(sorted(w)), []).append(w)
    return list(groups.values())
''',
    },
    {
        "slug": "top-k-frequent",
        "title": "Top K Frequent Elements",
        "difficulty": "medium",
        "topics": ["Hashing", "Heap"],
        "statement": "Return the `k` most frequent numbers in `nums`, in any order. The answer is unique.",
        "constraints": ["1 ≤ len(nums) ≤ 10⁵", "Better than O(n log n) is possible"],
        "python": "def top_k_frequent(nums: list[int], k: int) -> list[int]:",
        "js": "function topKFrequent(nums, k) {",
        "compare": "unordered",
        "tests": [_t([[1, 1, 1, 2, 2, 3], 2], [1, 2]), _t([[1], 1], [1]),
                  _t([[4, 4, 4, 4, 5, 5, 5, 6, 6, 7], 3], [4, 5, 6], True),
                  _t([[-1, -1, 2, 2, 2, 3], 1], [2], True)],
        "reference": '''
def top_k_frequent(nums, k):
    from collections import Counter
    return [n for n, _ in Counter(nums).most_common(k)]
''',
    },
    {
        "slug": "product-except-self",
        "title": "Product of Array Except Self",
        "difficulty": "medium",
        "topics": ["Arrays", "Prefix sums"],
        "statement": "Return a list where element i is the product of every element of `nums` except "
                     "nums[i]. Do not use division, and run in O(n).",
        "constraints": ["2 ≤ len(nums) ≤ 10⁵"],
        "python": "def product_except_self(nums: list[int]) -> list[int]:",
        "js": "function productExceptSelf(nums) {",
        "compare": "exact",
        "tests": [_t([[1, 2, 3, 4]], [24, 12, 8, 6]), _t([[-1, 1, 0, -3, 3]], [0, 0, 9, 0, 0]),
                  _t([[2, 3]], [3, 2], True), _t([[0, 0]], [0, 0], True), _t([[5, -2, 4, 1]], [-8, 20, -10, -40], True)],
        "reference": '''
def product_except_self(nums):
    n = len(nums)
    out = [1] * n
    left = 1
    for i in range(n):
        out[i] = left
        left *= nums[i]
    right = 1
    for i in range(n - 1, -1, -1):
        out[i] *= right
        right *= nums[i]
    return out
''',
    },
    {
        "slug": "merge-intervals",
        "title": "Merge Intervals",
        "difficulty": "medium",
        "topics": ["Intervals", "Sorting"],
        "statement": "Merge all overlapping intervals and return them sorted by start. Intervals that touch "
                     "(end == start) overlap.",
        "constraints": ["1 ≤ len(intervals) ≤ 10⁴"],
        "python": "def merge_intervals(intervals: list[list[int]]) -> list[list[int]]:",
        "js": "function mergeIntervals(intervals) {",
        "compare": "exact",
        "tests": [_t([[[1, 3], [2, 6], [8, 10], [15, 18]]], [[1, 6], [8, 10], [15, 18]]),
                  _t([[[1, 4], [4, 5]]], [[1, 5]]), _t([[[1, 4], [0, 4]]], [[0, 4]], True),
                  _t([[[1, 4], [2, 3]]], [[1, 4]], True), _t([[[5, 7], [1, 2], [3, 4]]], [[1, 2], [3, 4], [5, 7]], True)],
        "reference": '''
def merge_intervals(intervals):
    out = []
    for s, e in sorted(intervals):
        if out and s <= out[-1][1]:
            out[-1][1] = max(out[-1][1], e)
        else:
            out.append([s, e])
    return out
''',
    },
    {
        "slug": "search-rotated-array",
        "title": "Search in Rotated Sorted Array",
        "difficulty": "medium",
        "topics": ["Binary search"],
        "statement": "A sorted list of distinct integers was rotated at an unknown pivot. Return the index "
                     "of `target`, or -1 if it is absent, in O(log n).",
        "constraints": ["1 ≤ len(nums) ≤ 5000"],
        "python": "def search_rotated(nums: list[int], target: int) -> int:",
        "js": "function searchRotated(nums, target) {",
        "compare": "exact",
        "tests": [_t([[4, 5, 6, 7, 0, 1, 2], 0], 4), _t([[4, 5, 6, 7, 0, 1, 2], 3], -1), _t([[1], 0], -1, True),
                  _t([[3, 1], 1], 1, True), _t([[5, 1, 3], 5], 0, True), _t([[1, 2, 3, 4, 5], 4], 3, True)],
        "reference": '''
def search_rotated(nums, target):
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == target:
            return mid
        if nums[lo] <= nums[mid]:
            if nums[lo] <= target < nums[mid]:
                hi = mid - 1
            else:
                lo = mid + 1
        else:
            if nums[mid] < target <= nums[hi]:
                lo = mid + 1
            else:
                hi = mid - 1
    return -1
''',
    },
    {
        "slug": "number-of-islands",
        "title": "Number of Islands",
        "difficulty": "medium",
        "topics": ["Graphs", "BFS/DFS"],
        "statement": "`grid` is a 2D list of 1s (land) and 0s (water). Count the islands: groups of land "
                     "connected horizontally or vertically.",
        "constraints": ["1 ≤ rows, cols ≤ 300"],
        "python": "def num_islands(grid: list[list[int]]) -> int:",
        "js": "function numIslands(grid) {",
        "compare": "exact",
        "tests": [_t([[[1, 1, 0, 0, 0], [1, 1, 0, 0, 0], [0, 0, 1, 0, 0], [0, 0, 0, 1, 1]]], 3),
                  _t([[[1, 1, 1], [0, 1, 0], [1, 1, 1]]], 1), _t([[[0]]], 0, True),
                  _t([[[1, 0, 1], [0, 1, 0], [1, 0, 1]]], 5, True)],
        "reference": '''
def num_islands(grid):
    rows, cols = len(grid), len(grid[0])
    seen = set()
    count = 0
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == 1 and (r, c) not in seen:
                count += 1
                stack = [(r, c)]
                seen.add((r, c))
                while stack:
                    y, x = stack.pop()
                    for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                        if 0 <= ny < rows and 0 <= nx < cols and grid[ny][nx] == 1 and (ny, nx) not in seen:
                            seen.add((ny, nx))
                            stack.append((ny, nx))
    return count
''',
    },
    {
        "slug": "coin-change",
        "title": "Coin Change",
        "difficulty": "medium",
        "topics": ["Dynamic programming"],
        "statement": "Return the fewest coins needed to make `amount` using unlimited coins of the given "
                     "denominations, or -1 if it cannot be made.",
        "constraints": ["1 ≤ len(coins) ≤ 12", "0 ≤ amount ≤ 10⁴"],
        "python": "def coin_change(coins: list[int], amount: int) -> int:",
        "js": "function coinChange(coins, amount) {",
        "compare": "exact",
        "tests": [_t([[1, 2, 5], 11], 3), _t([[2], 3], -1), _t([[1], 0], 0), _t([[2, 5, 10, 1], 27], 4, True),
                  _t([[186, 419, 83, 408], 6249], 20, True), _t([[3, 7], 5], -1, True)],
        "reference": '''
def coin_change(coins, amount):
    best = [0] + [float("inf")] * amount
    for a in range(1, amount + 1):
        for c in coins:
            if c <= a and best[a - c] + 1 < best[a]:
                best[a] = best[a - c] + 1
    return best[amount] if best[amount] != float("inf") else -1
''',
    },
    {
        "slug": "daily-temperatures",
        "title": "Daily Temperatures",
        "difficulty": "medium",
        "topics": ["Stack"],
        "statement": "For each day, return how many days you must wait for a warmer temperature, or 0 if "
                     "there is no warmer day ahead.",
        "constraints": ["1 ≤ len(temps) ≤ 10⁵", "Aim for O(n)"],
        "python": "def daily_temperatures(temps: list[int]) -> list[int]:",
        "js": "function dailyTemperatures(temps) {",
        "compare": "exact",
        "tests": [_t([[73, 74, 75, 71, 69, 72, 76, 73]], [1, 1, 4, 2, 1, 1, 0, 0]), _t([[30, 40, 50, 60]], [1, 1, 1, 0]),
                  _t([[30, 60, 90]], [1, 1, 0], True), _t([[90, 80, 70]], [0, 0, 0], True)],
        "reference": '''
def daily_temperatures(temps):
    out = [0] * len(temps)
    stack = []
    for i, t in enumerate(temps):
        while stack and temps[stack[-1]] < t:
            j = stack.pop()
            out[j] = i - j
        stack.append(i)
    return out
''',
    },
    {
        "slug": "kth-largest",
        "title": "Kth Largest Element",
        "difficulty": "medium",
        "topics": ["Heap", "Sorting"],
        "statement": "Return the k-th largest element in `nums` (by sorted position, so duplicates count).",
        "constraints": ["1 ≤ k ≤ len(nums) ≤ 10⁵"],
        "python": "def kth_largest(nums: list[int], k: int) -> int:",
        "js": "function kthLargest(nums, k) {",
        "compare": "exact",
        "tests": [_t([[3, 2, 1, 5, 6, 4], 2], 5), _t([[3, 2, 3, 1, 2, 4, 5, 5, 6], 4], 4), _t([[1], 1], 1, True),
                  _t([[-1, -1, -2], 3], -2, True), _t([[7, 7, 7, 7], 2], 7, True)],
        "reference": '''
def kth_largest(nums, k):
    import heapq
    return heapq.nlargest(k, nums)[-1]
''',
    },
    {
        "slug": "meeting-rooms",
        "title": "Minimum Meeting Rooms",
        "difficulty": "medium",
        "topics": ["Intervals", "Heap"],
        "statement": "Each meeting is [start, end). Return the minimum number of rooms needed so no two "
                     "overlapping meetings share a room. A meeting ending at t frees its room for one starting at t.",
        "constraints": ["1 ≤ len(meetings) ≤ 10⁴"],
        "python": "def min_meeting_rooms(meetings: list[list[int]]) -> int:",
        "js": "function minMeetingRooms(meetings) {",
        "compare": "exact",
        "tests": [_t([[[0, 30], [5, 10], [15, 20]]], 2), _t([[[7, 10], [2, 4]]], 1), _t([[[1, 5], [5, 10]]], 1, True),
                  _t([[[1, 10], [2, 9], [3, 8], [4, 7]]], 4, True), _t([[[9, 10], [4, 9], [4, 17]]], 2, True)],
        "reference": '''
def min_meeting_rooms(meetings):
    import heapq
    ends = []
    for s, e in sorted(meetings):
        if ends and ends[0] <= s:
            heapq.heapreplace(ends, e)
        else:
            heapq.heappush(ends, e)
    return len(ends)
''',
    },
    {
        "slug": "rotting-oranges",
        "title": "Rotting Oranges",
        "difficulty": "medium",
        "topics": ["Graphs", "BFS/DFS"],
        "statement": "In `grid`, 0 is empty, 1 is a fresh orange and 2 is a rotten one. Each minute, fresh "
                     "oranges next to a rotten one (up, down, left, right) rot. Return the minutes until no "
                     "fresh orange is left, or -1 if that never happens.",
        "constraints": ["1 ≤ rows, cols ≤ 10"],
        "python": "def oranges_rotting(grid: list[list[int]]) -> int:",
        "js": "function orangesRotting(grid) {",
        "compare": "exact",
        "tests": [_t([[[2, 1, 1], [1, 1, 0], [0, 1, 1]]], 4), _t([[[2, 1, 1], [0, 1, 1], [1, 0, 1]]], -1),
                  _t([[[0, 2]]], 0, True), _t([[[1]]], -1, True), _t([[[2, 2], [1, 1]]], 1, True)],
        "reference": '''
def oranges_rotting(grid):
    from collections import deque
    rows, cols = len(grid), len(grid[0])
    q = deque((r, c) for r in range(rows) for c in range(cols) if grid[r][c] == 2)
    fresh = sum(row.count(1) for row in grid)
    g = [row[:] for row in grid]
    minutes = 0
    while q and fresh:
        for _ in range(len(q)):
            r, c = q.popleft()
            for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
                if 0 <= nr < rows and 0 <= nc < cols and g[nr][nc] == 1:
                    g[nr][nc] = 2
                    fresh -= 1
                    q.append((nr, nc))
        minutes += 1
    return -1 if fresh else minutes
''',
    },
    # ------------------------------------------------------------------ hard
    {
        "slug": "longest-increasing-subsequence",
        "title": "Longest Increasing Subsequence",
        "difficulty": "hard",
        "topics": ["Dynamic programming", "Binary search"],
        "statement": "Return the length of the longest strictly increasing subsequence of `nums`. An "
                     "O(n log n) solution exists.",
        "constraints": ["1 ≤ len(nums) ≤ 2500"],
        "python": "def lis_length(nums: list[int]) -> int:",
        "js": "function lisLength(nums) {",
        "compare": "exact",
        "tests": [_t([[10, 9, 2, 5, 3, 7, 101, 18]], 4), _t([[0, 1, 0, 3, 2, 3]], 4), _t([[7, 7, 7, 7]], 1, True),
                  _t([[4, 10, 4, 3, 8, 9]], 3, True), _t([[1, 3, 6, 7, 9, 4, 10, 5, 6]], 6, True)],
        "reference": '''
def lis_length(nums):
    import bisect
    tails = []
    for n in nums:
        i = bisect.bisect_left(tails, n)
        if i == len(tails):
            tails.append(n)
        else:
            tails[i] = n
    return len(tails)
''',
    },
    {
        "slug": "edit-distance",
        "title": "Edit Distance",
        "difficulty": "hard",
        "topics": ["Dynamic programming", "Strings"],
        "statement": "Return the minimum number of single-character inserts, deletes or replacements "
                     "needed to turn `a` into `b`.",
        "constraints": ["0 ≤ len(a), len(b) ≤ 500"],
        "python": "def edit_distance(a: str, b: str) -> int:",
        "js": "function editDistance(a, b) {",
        "compare": "exact",
        "tests": [_t(["horse", "ros"], 3), _t(["intention", "execution"], 5), _t(["", "abc"], 3, True),
                  _t(["same", "same"], 0, True), _t(["kitten", "sitting"], 3, True)],
        "reference": '''
def edit_distance(a, b):
    prev = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        cur = [i] + [0] * len(b)
        for j in range(1, len(b) + 1):
            cur[j] = prev[j - 1] if a[i - 1] == b[j - 1] else 1 + min(prev[j - 1], prev[j], cur[j - 1])
        prev = cur
    return prev[-1]
''',
    },
    {
        "slug": "shortest-path-in-grid",
        "title": "Shortest Path in a Grid",
        "difficulty": "hard",
        "topics": ["Graphs", "BFS/DFS"],
        "statement": "`grid` has 0 for open cells and 1 for walls. Moving up, down, left or right, return the "
                     "number of steps in the shortest path from the top-left to the bottom-right cell, or -1 "
                     "if there is none. Start and end may be walls.",
        "constraints": ["1 ≤ rows, cols ≤ 100"],
        "python": "def shortest_path(grid: list[list[int]]) -> int:",
        "js": "function shortestPath(grid) {",
        "compare": "exact",
        "tests": [_t([[[0, 0, 0], [1, 1, 0], [0, 0, 0]]], 4), _t([[[0, 1], [1, 0]]], -1), _t([[[0]]], 0, True),
                  _t([[[0, 0, 0, 0], [1, 1, 1, 0], [0, 0, 0, 0], [0, 1, 1, 1], [0, 0, 0, 0]]], 13, True),
                  _t([[[1, 0], [0, 0]]], -1, True)],
        "reference": '''
def shortest_path(grid):
    from collections import deque
    rows, cols = len(grid), len(grid[0])
    if grid[0][0] or grid[-1][-1]:
        return -1
    q = deque([(0, 0, 0)])
    seen = {(0, 0)}
    while q:
        r, c, d = q.popleft()
        if (r, c) == (rows - 1, cols - 1):
            return d
        for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
            if 0 <= nr < rows and 0 <= nc < cols and not grid[nr][nc] and (nr, nc) not in seen:
                seen.add((nr, nc))
                q.append((nr, nc, d + 1))
    return -1
''',
    },
    {
        "slug": "trapping-rain-water",
        "title": "Trapping Rain Water",
        "difficulty": "hard",
        "topics": ["Two pointers", "Arrays"],
        "statement": "`heights` is an elevation map where each bar has width 1. Return how much water is "
                     "trapped after it rains.",
        "constraints": ["1 ≤ len(heights) ≤ 2·10⁴", "Aim for O(n) time and O(1) space"],
        "python": "def trap(heights: list[int]) -> int:",
        "js": "function trap(heights) {",
        "compare": "exact",
        "tests": [_t([[0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]], 6), _t([[4, 2, 0, 3, 2, 5]], 9), _t([[1]], 0, True),
                  _t([[5, 4, 3, 2, 1]], 0, True), _t([[3, 0, 0, 2, 0, 4]], 10, True)],
        "reference": '''
def trap(heights):
    lo, hi = 0, len(heights) - 1
    left_max = right_max = water = 0
    while lo < hi:
        if heights[lo] < heights[hi]:
            left_max = max(left_max, heights[lo])
            water += left_max - heights[lo]
            lo += 1
        else:
            right_max = max(right_max, heights[hi])
            water += right_max - heights[hi]
            hi -= 1
    return water
''',
    },
    {
        "slug": "course-schedule",
        "title": "Course Schedule",
        "difficulty": "hard",
        "topics": ["Graphs", "Topological sort"],
        "statement": "There are `n` courses numbered 0..n-1. Each pair [a, b] in `prerequisites` means you "
                     "must take b before a. Return true if you can finish every course.",
        "constraints": ["1 ≤ n ≤ 2000", "0 ≤ len(prerequisites) ≤ 5000"],
        "python": "def can_finish(n: int, prerequisites: list[list[int]]) -> bool:",
        "js": "function canFinish(n, prerequisites) {",
        "compare": "exact",
        "tests": [_t([2, [[1, 0]]], True), _t([2, [[1, 0], [0, 1]]], False), _t([1, []], True, True),
                  _t([4, [[1, 0], [2, 1], [3, 2], [1, 3]]], False, True), _t([5, [[1, 0], [2, 0], [3, 1], [4, 3]]], True, True)],
        "reference": '''
def can_finish(n, prerequisites):
    from collections import deque
    indeg = [0] * n
    nxt = [[] for _ in range(n)]
    for a, b in prerequisites:
        nxt[b].append(a)
        indeg[a] += 1
    q = deque(i for i in range(n) if indeg[i] == 0)
    done = 0
    while q:
        c = q.popleft()
        done += 1
        for a in nxt[c]:
            indeg[a] -= 1
            if indeg[a] == 0:
                q.append(a)
    return done == n
''',
    },
    {
        "slug": "sliding-window-maximum",
        "title": "Sliding Window Maximum",
        "difficulty": "hard",
        "topics": ["Sliding window", "Deque"],
        "statement": "Return the maximum of each window of size `k` as it slides from left to right "
                     "across `nums`. Aim for O(n).",
        "constraints": ["1 ≤ k ≤ len(nums) ≤ 10⁵"],
        "python": "def max_sliding_window(nums: list[int], k: int) -> list[int]:",
        "js": "function maxSlidingWindow(nums, k) {",
        "compare": "exact",
        "tests": [_t([[1, 3, -1, -3, 5, 3, 6, 7], 3], [3, 3, 5, 5, 6, 7]), _t([[1], 1], [1]),
                  _t([[9, 8, 7, 6], 2], [9, 8, 7], True), _t([[1, 2, 3, 4], 4], [4], True),
                  _t([[4, -2], 1], [4, -2], True)],
        "reference": '''
def max_sliding_window(nums, k):
    from collections import deque
    dq, out = deque(), []
    for i, n in enumerate(nums):
        while dq and nums[dq[-1]] <= n:
            dq.pop()
        dq.append(i)
        if dq[0] <= i - k:
            dq.popleft()
        if i >= k - 1:
            out.append(nums[dq[0]])
    return out
''',
    },
]

BY_SLUG = {p["slug"]: p for p in PROBLEMS}
