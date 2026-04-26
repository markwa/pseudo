names = ["Ada", "Bo", "Cara", "Dana", "Eli"]
board = [[1, 2], [3, 4]]
writer = openWrite("sample.txt")
writer.writeLine("Hello World")
writer.close()

reader = openRead("sample.txt")
print(names[3])
print(str(len(names)))
print("input"[1:4])
print(reader.readLine())
reader.close()
