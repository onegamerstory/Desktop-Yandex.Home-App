# ПК-приложение для управления Умным Домом Яндекс
Приложение для ПК, которое позволяет управлять Умным домом Яндекс: запуск сценариев, включение/выключение устройств.

В процессе написания приложения использовалась официальная документация [API Яндекс Умный Дом](https://yandex.ru/dev/dialogs/smart-home/doc/ru/concepts/platform-quickstart)

![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/onegamerstory/Desktop-Yandex.Home-App/total)
![GitHub Repo stars](https://img.shields.io/github/stars/onegamerstory/Desktop-Yandex.Home-App)
![GitHub Release](https://img.shields.io/github/v/release/onegamerstory/Desktop-Yandex.Home-App)


# 🎯 Возможности
- 🖥️ Работа на всех ПК-платформах: Windows, MacOS, Linux
- ⚡ Запуск сценариев
- 🔌 Включение/выключение устройств умного дома
- ⭐ Сохранение устройства, группы устройств или сценария в список "Избранных"
- 📥 Работа с "Избранными" устройствами/сценариями через трей
- 🔄 Обновление состояния устройств каждые 30 секунд
- 🌈 Настройка освещения: яркость, температура света, цвет света
- 🌡️ Настройка климата (кондиционеры): температура, режим работы, направление воздуха
- 👁️‍🗨️ Поддержка камер видеонаблюдения Яндекс
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

В качестве идентификатора приложения подставляем `ClientID` нашего приложения **(не забудьте удалить скобки** `<>`**)**:
<img width="1150" height="400" alt="image" src="https://github.com/user-attachments/assets/43bc0afb-340c-4113-ac93-e75e8651714e" />

После перехода по этой ссылке, мы попадаем на страницу с токеном - копируем его и сохраняем в укромном месте!
<img width="1150" height="119" alt="image" src="https://github.com/user-attachments/assets/786aa06a-5c06-4ac9-8635-e0da62a92575" />


# 🚀 Установка приложения

## 1. Установка

Скачиваем установщик, выложенный на [странице релизов](https://github.com/onegamerstory/Desktop-Yandex.Home-App/releases), запускаем его.

### Информация для macOS

В релизах два установщика:

- `...-arm64.dmg` — Mac с чипом Apple (M1/M2/M3/M4)
- `...-x64.dmg` — Mac с процессором Intel

Чип можно посмотреть в «Об этом Mac». Если скачать не ту архитектуру, система напишет, что приложение не поддерживается этим компьютером.

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

<img width="1479" height="972" alt="image" src="https://github.com/user-attachments/assets/e68eee4d-4daa-4ef8-bf88-f2224f257ae3" />

Если в умном доме есть камеры, то приложение запросит у вас дополнительное подтверждение через Яндекс для доступа к видеопотоку: 

<img width="1479" height="972" alt="image" src="https://github.com/user-attachments/assets/58dd36f8-e41a-4e29-8736-a73680d60db7" />

Пример видеопотока с камеры: 
<img width="1479" height="972" alt="image" src="https://github.com/user-attachments/assets/b86fd6ad-274c-421c-baaf-5d8aa52e2d00" />

После пользователь попадает в основное окно со всеми устройствами и сценариями Умного дома, которые были настроены через приложение **"Умный дом с Алисой"**

<img width="1479" height="972" alt="image" src="https://github.com/user-attachments/assets/152b50ba-df2d-4489-81db-c93154cf4bbd" />
<img width="1479" height="972" alt="image" src="https://github.com/user-attachments/assets/263c7eac-8e3d-48a1-8e94-07db4a63b9df" />

### 2.1. Боковое меню

На боковом меню отображена вся структура умного дома отдельными категориями (комнаты, группы, сценарии, датчики), а также имеется возможность переключиться между несколькими домами: 

<img width="1479" height="972" alt="image" src="https://github.com/user-attachments/assets/405ffba8-d02d-4b4f-925d-c1d51b029e91" />

### 2.2. Датчики

Возможность вывода необходимой информации на датчик через меню настроек для конкретного устройства:

<img width="750" height="642" alt="image" src="https://github.com/user-attachments/assets/d45ecdb4-e806-45e6-be17-fe4792f7384a" />
<img width="612" height="641" alt="image" src="https://github.com/user-attachments/assets/78813953-a649-47e3-afef-fc8b140fb48d" />

А при добавлении датчика в "Избранное" все показатели будут отображаться в трее:

<img width="419" height="137" alt="image" src="https://github.com/user-attachments/assets/8fbd046a-ff86-4062-a749-18fb7f3407fe" />

### 2.3. Управление светом

У световых устройств и групп световых устройств есть возможность настройки яркости, температуры и цвета освещения: 

<img width="575" height="589" alt="image" src="https://github.com/user-attachments/assets/c2e71de6-9529-4fa4-ac33-768051e50f22" />
<img width="552" height="468" alt="image" src="https://github.com/user-attachments/assets/0e7f5a3e-64e8-4eba-8139-0857239b425b" />

### 2.4. Управление температурой

У таких устройств, как кондиционеры, вентиляторы и термостаты есть возможность настройки температуры, скорости обдува и переключение режимов в зависимости от особенностей устройства:

<img width="543" height="514" alt="image" src="https://github.com/user-attachments/assets/f1b29d6a-2f3e-43b7-8c14-5658b672b192" />

<img width="537" height="645" alt="image" src="https://github.com/user-attachments/assets/8328bbdd-3018-4da6-a2a2-c4ea37774fea" />

### 2.5. Избранное

Все устройства или сценарии, добавленные в Избранное, становятся доступными в трее. Если это устройство с переключением состояний (ВКЛ/ВЫКЛ) или сценарий, то можно управлять запуском/отключением прямо из трей:

<img width="207" height="185" alt="image" src="https://github.com/user-attachments/assets/0d39f13d-a98e-438a-a825-2571c94c2559" />


## 3. Удаление

Программа удаляется классическим образом для вашей ОС - через список установленных программ

<img width="1043" height="243" alt="image" src="https://github.com/user-attachments/assets/2a53221b-2625-4c08-a04e-2ba4ed6194fe" />


# 🔐 Безопасность

## Где и как хранятся токены пользователя?

Приложение использует два токена. Оба хранятся в защищённом хранилище, управляемом операционной системой (через [keytar](https://github.com/atom/node-keytar)), в зашифрованном виде.

| Запись в хранилище | Назначение | Как попадает в хранилище |
|---|---|---|
| `SmartHomeControlApp/YandexToken` | OAuth-токен Умного дома — управление устройствами, сценариями | Вводится вручную на экране входа |
| `SmartHomeControlApp/YandexXToken` | X-Token для Quasar API — просмотр камер | Получается один раз через QR-авторизацию (при первом открытии камеры или при истечении) |

Краткоживущий JWT для WebRTC-потока камеры **не сохраняется** в хранилище: он запрашивается у сервера при каждом подключении и обновляется автоматически во время просмотра.

X-Token **не продлевается автоматически**. При истечении или ошибке авторизации приложение удаляет его из хранилища и предлагает пройти QR-авторизацию заново.

### Для Windows

<img width="749" height="623" alt="image" src="https://github.com/user-attachments/assets/f54c49c6-5865-4301-984f-19c8bc8cf4ac" />


1. Откройте `Диспетчер учетных данных` (или `Credential Manager`)
2. Перейдите на вкладку `Учетные данные Windows` (`Windows Credentials`)
3. В разделе `Общие учетные данные` найдите записи `SmartHomeControlApp/YandexToken` и `SmartHomeControlApp/YandexXToken`

## Как удалить токены из хранилища?

- Нажать кнопку `Выхода` в верхнем углу приложения — удаляются оба токена
- Вручную удалить записи из хранилища


#  🔗 Ссылки и поддержка

Поддержать проект можно подпиской на мои соц.сети или донатом:
- Подписка или донат на [Boosty](https://boosty.to/onegamerstory)
- Донат на странице [Donatty](https://donatty.com/onegamerstory)
- [Телеграм-канал](https://t.me/onegamerstory) для связи со мной
- Мой [YouTube-канал](https://youtube.com/@onegamerstory)
