"""Smallest missing positive integer.

Given an unsorted integer array, return the smallest positive integer (n > 0)
that is not present in it. Example: [0, -2, 1, 2] -> 3.

Key idea: for an array of length n the answer is always between 1 and n + 1.
There are n + 1 candidates (1..n+1) but only n elements, so one candidate must be missing.

Run the checks with:  python first_missing_positive.py
"""


def first_missing_positive(nums):
    """Method 1: set. O(n) time, O(n) extra memory."""
    seen = set(nums)
    n = 1
    while n in seen:
        n += 1
    return n


def first_missing_positive_in_place(nums):
    """Method 2: put each value v at index v - 1, then find the first wrong slot.
    O(n) time, O(1) extra memory. Modifies the input array in place."""
    n = len(nums)
    for i in range(n):
        while 1 <= nums[i] <= n and nums[nums[i] - 1] != nums[i]:
            j = nums[i] - 1
            nums[i], nums[j] = nums[j], nums[i]
    for i in range(n):
        if nums[i] != i + 1:
            return i + 1
    return n + 1


if __name__ == "__main__":
    cases = [
        ([0, -2, 1, 2], 3),
        ([1, 2, 0], 3),
        ([3, 4, -1, 1], 2),
        ([7, 8, 9], 1),
        ([1, 1, 1], 2),
        ([2, 2], 1),
        ([1], 2),
        ([], 1),
    ]
    for nums, expected in cases:
        for fn in (first_missing_positive, first_missing_positive_in_place):
            assert fn(nums[:]) == expected, (fn.__name__, nums, expected)
    print("All checks passed")
