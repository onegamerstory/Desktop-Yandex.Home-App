# Desktop-Yandex.Home-App
Приложение для ПК, которое позволяет управлять Умным домо Яндекс: запуск сценариев, включение/выключение устройств

# Получение токена Умного дома Яндекс 

## 1. Создаем/регистрируем приложение на сервере авторизации Яндекс OAuth 

Переходим по [ссылке](https://passport.yandex.ru/auth?retpath=https%3A%2F%2Foauth.yandex.ru%2Fclient%2Fnew%2F&noreturn=1) на Яндекс OAuth

В качестве платформы приложения выбираем Веб-сервисы, а в строке _Redirect URI_ выбираем пункт **"Подставить URL для отладки"**
<img width="1486" height="837" alt="image" src="https://github.com/user-attachments/assets/312922ba-3126-48a2-a082-4a8c540419dd" />

В доступах к данным сами прописываем два доступа: 
- iot:view
- iot:control

<img width="841" height="213" alt="image" src="https://github.com/user-attachments/assets/d5a3cb15-4262-4842-9f92-c003b8b37310" />
<img width="821" height="205" alt="image" src="https://github.com/user-attachments/assets/aa071db0-1956-4521-b6e4-e8df0df86bc0" />


## 2. Получаем токен для нашего приложения

После того, как приложение будет создано, нужно перейти по адресу:

`https://oauth.yandex.ru/authorize?response_type=token&client_id=<идентификатор приложения>`

В качестве идентификатора приложения подставляем _ClientID_ нашего приложения:
<img width="1150" height="400" alt="image" src="https://github.com/user-attachments/assets/43bc0afb-340c-4113-ac93-e75e8651714e" />

После перехода по этой ссылке, мы попадаем на страницу с токеном - копируем его и сохраняем в укромном месте!
<img width="1150" height="119" alt="image" src="https://github.com/user-attachments/assets/786aa06a-5c06-4ac9-8635-e0da62a92575" />
