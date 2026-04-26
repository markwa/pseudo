def triple(number):
    return number * 3

class Pet:
    def __init__(self, given_name):
        self.name = given_name

    def get_name(self):
        return self.name

class Dog(Pet):
    def __init__(self, given_name, given_breed):
        super().__init__(given_name)
        self.breed = given_breed

    def describe(self):
        return self.get_name() + " - " + self.breed

print("hello " + "Hamish")
dog = Dog("Fido", "Scottish Terrier")
print(dog.describe())
