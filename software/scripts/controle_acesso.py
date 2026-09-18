from time import sleep

def liberar_acesso(nome: str) -> None:
    print(f"ACESSO LIBERADO PARA: {nome}")
    print("Fechadura aberta")

    sleep(3)

    print("Fechadura fechada")