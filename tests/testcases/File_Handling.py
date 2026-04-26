writer = openWrite("sample.txt")
writer.writeLine("alpha")
writer.writeLine("beta")
writer.close()

reader = openRead("sample.txt")
while not reader.endOfFile():
    print(reader.readLine())
reader.close()
