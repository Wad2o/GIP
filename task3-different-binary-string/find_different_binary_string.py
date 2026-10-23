# Méthode : diagonale (argument diagonal de Cantor)
# On construit r avec r[i] = 1 - nums[i][i] :
# l'opposé du i-ème caractère de la i-ème chaîne.

def find_different_binary_string(nums):
    return "".join(str(1 - int(nums[i][i])) for i in range(len(nums)))


if __name__ == "__main__":
    print(find_different_binary_string(["110", "001", "101"]))  # 010
    print(find_different_binary_string(["010", "001", "101"]))  # 110
    print(find_different_binary_string(["01", "10"]))           # 11