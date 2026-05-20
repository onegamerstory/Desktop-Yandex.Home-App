# ПК-приложение для управления Умным Домом Яндекс
Приложение для ПК, которое позволяет управлять Умным домо Яндекс: запуск сценариев, включение/выключение устройств.

В процессе написания приложения использовалась официальная документация [API Яндекс Умный Дом](https://yandex.ru/dev/dialogs/smart-home/doc/ru/concepts/platform-quickstart)

# 🎯 Возможности
- 🖥️ Работа на всех ПК-платформах: Windows, MacOS, Linux
- ⚡ Запуск сценариев
- 🔌 Включение/выключение устройств умного дома
- ⭐ Сохранение устройства или сценария в список "Избранных"
- 📥 Работа с "Избранными" устройствами/сценариями через трей
- 🔄 Обновление состояния устройств каждые 30 секунд
- 🌈 Настройка освещения: яркость, температура света, цвет света
- 🌡️ Настройка климата (кондиционеры): температура, режим работы, направление воздуха
- 🏠🏠 Поддержка нескольких домов
- 🚀 Автозапуск при старте ПК
- 🔄🖥️ Автоматическая проверка доступных обновлений при запуске приложения
- 🌐 Повторные попытки подключиться при отсутствии интернет-соединения
- 🌓 Темная/светлая темы

#  🔑 Получение токена Умного дома Яндекс

## 1. Создаем/регистрируем приложение на сервере авторизации Яндекс OAuth 

Переходим по [ссылке](https://passport.yandex.ru/auth?retpath=https%3A%2F%2Foauth.yandex.ru%2Fclient%2Fnew%2F&noreturn=1) на Яндекс OAuth.

Нажимаем `Создать приложение` или сайт сам предложит это сделать. Выбираем пункт `Для доступа к API или отладки`:

<img width="465" height="439" alt="image" src="https://github.com/user-attachments/assets/6eb53c26-2aa2-4b95-a812-ab4e198c9432" />

На странице заполняем название (любое), а ниже в поле `Доступ к данным` сами прописываем два доступа: 
- `iot:view`
- `iot:control`

<img width="639" height="324" alt="image" src="https://github.com/user-attachments/assets/0f48040c-a19d-42f1-9c3a-d3a72783f224" />


## 2. Получаем токен для нашего приложения

После того, как приложение будет создано, нужно перейти по адресу:

`https://oauth.yandex.ru/authorize?response_type=token&client_id=<идентификатор приложения>`

В качестве идентификатора приложения подставляем `ClientID` нашего приложения:
<img width="1150" height="400" alt="image" src="https://github.com/user-attachments/assets/43bc0afb-340c-4113-ac93-e75e8651714e" />

После перехода по этой ссылке, мы попадаем на страницу с токеном - копируем его и сохраняем в укромном месте!
<img width="1150" height="119" alt="image" src="https://github.com/user-attachments/assets/786aa06a-5c06-4ac9-8635-e0da62a92575" />


# 🚀 Установка приложения

## 1. Установка

Скачиваем установщик, выложенный на [странице релизов](https://github.com/onegamerstory/Desktop-Yandex.Home-App/releases), запускаем его.

### Информация для macOS

После установки `.dmg` файла при запуске приложения вы можете получите сообщение о том, что оно **_повреждено_**.

Так как я не являюсь зарегистрированным разработчиком, и моей поделки нет в AppStore, то следует обойти блокировку неподписанного приложения - ваш Mac не доверяет моему приложению, которое официально не подписано, и блокирует его при запуске.

В Терминале выполните команду: 

`xattr -d com.apple.quarantine /Applications/Yandex\ Smart\ Home\ Control.app`

Или с правами суперпользователя/администратора, добавив вначало `sudo`:

`sudo xattr -d com.apple.quarantine /Applications/Yandex\ Smart\ Home\ Control.app`

### Информация для Linux

Если вы используете файл .AppImage для установки программы и получаете ошибку, в которой упоминается sandbox, тогда для запуска нужно добавить ключик `--no-sandbox`:

`./Yandex.Smart.Home.Control.Setup.vX.Y.Z.AppImage --no-sandbox`


### Информация для Windows

Приложение автоматически установится в директорию пользователя: 
`C:\Users\<user>\AppData\Local\Programs\`

На рабочем столе и в меню пуск появится иконка программы.

## 2. Использование

При запуске приложения отобразится экран входа, где основным параметром входа будет являться токен Умного дома Яндекс.

<img width="554" height="566" alt="image" src="https://github.com/user-attachments/assets/b9777898-fbf7-4b80-938b-79c240cc2f50" />



После пользователь попадает в основное окно со всеми устройствами и сценариями Умного дома, которые были настроены через приложение **"Умный дом с Алисой"**

<img width="1083" height="974" alt="image" src="https://github.com/user-attachments/assets/d2aa7c23-80fb-47e4-8788-65689d423576" />
<img width="1083" height="974" alt="image" src="https://github.com/user-attachments/assets/3cfef3ac-5e90-459d-b087-a04c80c422b7" />
<img width="727" height="750" alt="image" src="https://github.com/user-attachments/assets/c8e8943e-ae14-436f-b45f-b03bb5eea2c0" />
<img width="678" height="590" alt="image" src="https://github.com/user-attachments/assets/4ae9bd11-d5ab-4cc0-ba37-a387d48de7d8" />
<img width="570" height="676" alt="image" src="https://github.com/user-attachments/assets/7d125328-bf0b-4650-94fc-63905c49ab92" />
<img width="299" height="248" alt="image" src="https://github.com/user-attachments/assets/632f125a-6137-4a10-8a4e-1cd4bd20682f" />


## 3. Удаление

Программа удаляется классическим образом для вашей ОС - через список установленных программ

<img width="1043" height="243" alt="image" src="https://github.com/user-attachments/assets/2a53221b-2625-4c08-a04e-2ba4ed6194fe" />


# 🔐 Безопасность

## Где и как храниться токен пользователя?

Токен хранится в защищенном хранилище, управляемом вашей операционной системой в зашифрованном виде.

### Для Windows

<img width="749" height="623" alt="image" src="https://github.com/user-attachments/assets/f54c49c6-5865-4301-984f-19c8bc8cf4ac" />


1. Откройте `Диспетчер учетных данных` (или `Credential Manager`)
2. Перейдите на вкладку `Учетные данные Windows` (`Windows Credentials`)
3. В разделе `Общие учетные данные` под названием `SmartHomeControlApp/YandexToken` хранится токен

## Как удалить токен пользователя из хранилища?

- Нажать кнопку `Выхода` в верхнем углу приложения
- Вручную удалить токен из хранилища


#  🔗 Ссылки и поддержка

Поддержать проект можно подпиской на мои соц.сети или донатом:
- Подписка или донат на [Boosty](https://boosty.to/onegamerstory)
- Донат на странице [Donatty](https://donatty.com/onegamerstory)
- [Телеграм-канал](https://t.me/onegamerstory) для связи со мной
- Мой [YouTube-канал](https://youtube.com/@onegamerstory)
