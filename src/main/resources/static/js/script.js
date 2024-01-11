window.addEventListener("load", function () {
    var gJson = {"collections":[]};
    var gfileContents;
    var glines;
    var gVars = [];
    var gMethod = document.getElementById("method");
    var gUrl = document.getElementById("url");
    var gJsonBody = document.getElementById("jsonBody");
    var gRequestName = document.getElementById("request-name");
    var btn_Save = document.getElementById("btnSave");
    var btn_Send = document.getElementById("btnSend");
    var lnkBeauty = this.document.getElementById("beautify");
    var errMessage = document.getElementById("error-message");
    const errFile = this.document.getElementById("fileError")
    var originalCollectionName; // Змінна для зберігання початкового змісту collection Name
    const collectionsList = document.getElementById('collectionsList');
    const gResponse = document.getElementById("response");
    const btnNewCollection = this.document.getElementById("new-collection");
    const runHeader = document.querySelector(".run-header");
    const runSettings = document.querySelector(".runner-settings");
    const headerName = document.querySelector("#run-collection h3");
    const sortList = this.document.getElementById("sortable-list");
    const btn_Run = this.document.getElementById("btn-run");
    const fileVars = this.document.getElementById("formFileSm");
    const btn_delFile = this.document.getElementById("btn-delete-file");
    const iterationsDiv = this.document.getElementById("iterationsDiv");
    const iterationsInput = this.document.getElementById("iterationsInput");
    const btn_Preview = this.document.getElementById("button-addon2");
    const num_Threads = this.document.getElementById("numThreads");
    const divResults = this.document.getElementById("results");
    const inputResults = divResults.querySelector("textarea");
    const stompClient = new StompJs.Client({
        brokerURL: 'ws://localhost:8080/ws-run-collection',
        splitLargeFrames: true
        // debug: function (str) {
        //     console.log(str);
        //   }
        //   ,
        //   heartbeatIncoming: 4000,
        //   heartbeatOutgoing: 4000
        // reconnectDelay: 50000
    });
    stompClient.onConnect = (frame) => {
        console.log('Connected: ' + frame);
        stompClient.subscribe('/user/topic/result', function (response) {
            var json = JSON.parse(response.body);
            console.log(json.body.status);
            if (json.body.status === 'stopping') {
                return
            }
            inputResults.value = inputResults.value + 'Status: ' + json.body.status + ', Passed: ' + json.body.passed + ', Failed: ' + json.body.failed + '\n';
            inputResults.scrollTop = inputResults.scrollHeight;
            if (json.body.status === 'finished' || json.body.status === 'stopped') {
                inputResults.value = inputResults.value + '\n' + json.body.status + '\n' + json.body.message;
                inputResults.scrollTop = inputResults.scrollHeight;
                disconnect();
                btn_Run.textContent = 'Run';
                btn_Run.disabled = false;
            }
        });
    };
    stompClient.onStompError = function (frame) {
        // Will be invoked in case of error encountered at Broker
        // Bad login/passcode typically will cause an error
        // Complaint brokers will set `message` header with a brief message. Body may contain details.
        // Compliant brokers will terminate the connection after any error
        console.log('Broker reported error: ' + frame.headers['message']);
        console.log('Additional details: ' + frame.body);
    };

    function disconnect() {
        stompClient.deactivate();
        console.log("Disconnected");
    }
    function sendArray(jsonArray) {
        stompClient.publish({
            destination: "/app/start-executing",
            body: jsonArray
        });
    }
    function connect() {
        stompClient.activate();
    }

    function isUrlValid(str) {
        const pattern = new RegExp(
            '^(https?:\\/\\/)?' + // protocol
            '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
            '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR IP (v4) address
            '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
            '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
            '(\\#[-a-z\\d_]*)?$', // fragment locator
            'i'
        );
        return pattern.test(str);
    }
    function validateJSON() {
        var jsonInput = gJsonBody.value;
        try {
            JSON.parse(jsonInput);
        } catch (error) {
            errMessage.innerText = "Invalid JSON: " + error.message;
            throw new Error("JSON invalid");
        }
    }
    function maxRequestId() {
        var maxId = 0;
        gJson.collections.forEach(collection => {
            collection.collection.requests.forEach(request => {
                if (request.id > maxId) {
                    maxId = request.id
                }
            })
        });
        return maxId;
    }

    function maxCollectiontId() {
        var maxId = 0;
        if (!gJson.collections) {
            return 0;
        }
        gJson.collections.forEach(collection => {
            if (collection.collection.id > maxId) {
                maxId = collection.collection.id
            }
        });
        return maxId;
    }

    function makeRequest() {
        errMessage.innerText = '';
        var method = document.getElementById("method").value;
        var url = document.getElementById("url").value;
        var jsonBody = document.getElementById("jsonBody").value;
        validateJSON();
        if (!isUrlValid(url)) {
            document.getElementById("error-message").innerText = "Incorrect URL";
            throw new Error("URL invalid");
        }
        fetch('/send-request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ method: method, url: url, jsonBody: jsonBody }),
        })
            .then(response => response.text())
            .then(data => {
                try {
                    gResponse.value = JSON.stringify(JSON.parse(data), null, 4);
                } catch (error) {
                    gResponse.value = data;
                    console.log(data);
                }
            });
    }
    function saveToFile(jsonData) {
        fetch('/save-to-file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(removeId(jsonData)),
        })
            .then(response => response.text())
            .then(data => {
                if (data === 'Saving error') {
                    errMessage.innerText = "Error during saving!";
                    throw new Error(data);
                }
                btn_Save.disabled = true;
            });
    }

    function addId(jsonData) {
        var cntCollection = 0;
        var cntRequest = 0;
        jsonData.collections.forEach(collection => {
            cntCollection++;
            collection.collection.id = cntCollection;
            collection.collection.requests.forEach(request => {
                cntRequest++;
                request.id = cntRequest;
            })
        });
        return jsonData;
    }
    function removeId(jsonData) {
        var newObject = JSON.parse(JSON.stringify(jsonData));
        newObject.collections.forEach(collection => {

            delete collection.collection.id;
            collection.collection.requests.forEach(request => {
                delete request.id;
            })
        });
        return newObject;
    }

    function createCollectionElement(collectionName, collectionId) {

        const listItem = document.createElement('li');
        listItem.classList.add("list-group-item", "border-0", "ps-0");
        // listItem.textContent = `${collectionName}:`;
        // listItem.setAttribute('data-id', collection.collection.id);
        const divCollectionHor = document.createElement('div');
        divCollectionHor.classList.add("list-group", "collection", "list-group-horizontal");
        divCollectionHor.addEventListener("mouseover", () => {
            divCollectionHor.querySelector(".dots").classList.remove("hide");
        });
        divCollectionHor.addEventListener("mouseleave", () => {
            divCollectionHor.querySelector(".dots").classList.add("hide");
        });
        const divCollection = document.createElement('div');
        divCollection.classList.add("ps-0", "list-group-item", "list-group-item-action", "border-0", "mt-0", "overflow-hidden", "show-plus");
        divCollection.textContent = `${collectionName}`;
        divCollection.addEventListener("click", () => {
            if (!divCollection.hasAttribute("contenteditable")) {
                const requestList = divCollection.parentElement.parentElement.querySelector("div:last-child");
                requestList.classList.toggle("hide");
                divCollection.classList.toggle("show-plus");
                divCollection.classList.toggle("show-minus");
            }
        });
        divCollection.addEventListener('blur', function () {
            if (originalCollectionName !== divCollection.innerHTML) {
                const itemId = divCollection.getAttribute('data-id');
                gJson.collections.forEach(collection => {
                    if (collection.collection.id === parseInt(itemId)) {
                        collection.collection.name = divCollection.innerHTML;
                    }
                });
                saveToFile(gJson);
            }
            divCollection.removeAttribute("contentEditable");
            divCollection.parentElement.classList.toggle("collection-edit");
            originalCollectionName = '';
        });

        divCollection.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.blur();
            }
        });
        divCollection.addEventListener('dragstart', function (event) {
            event.preventDefault();
        });
        divCollection.setAttribute('data-id', collectionId);
        const btnActionCollection = document.createElement('button');
        btnActionCollection.classList.add("dots", "list-group-item", "list-group-item-action", "hide");
        btnActionCollection.textContent = '...';
        btnActionCollection.addEventListener("click", (event) => {
            const activeActionMenu = document.querySelector(".show-menu");
            const currentActionMenu = listItem.querySelector(".collection + div");
            if (activeActionMenu && activeActionMenu !== currentActionMenu) {
                activeActionMenu.classList.toggle("show-menu");
                activeActionMenu.classList.toggle("hide");
            }
            currentActionMenu.classList.toggle("hide");
            currentActionMenu.classList.toggle("show-menu");
            event.stopPropagation();
        });
        divCollectionHor.appendChild(divCollection);
        divCollectionHor.appendChild(btnActionCollection);
        listItem.appendChild(divCollectionHor);
        const divActionMenu = document.createElement('div');
        divActionMenu.classList.add("action-div", "hide");
        const listAction = document.createElement('ul');
        listAction.classList.add("action-collection", "border", "rounded", "list-group");

        var listItemAction = document.createElement('li');
        listItemAction.classList.add("list-group-item", "border-0", "list-group-item-action");
        listItemAction.textContent = 'New request';
        listItemAction.addEventListener("click", (event) => {
            var activeActionMenu = listItemAction.parentElement.parentElement;
            activeActionMenu.classList.toggle("show-menu");
            activeActionMenu.classList.toggle("hide");
            // console.log(event.target.parentElement.parentElement.parentElement);
            const divReqGrp = event.target.parentElement.parentElement.parentElement.querySelector("div:last-child");

            const itemId = event.target.parentElement.parentElement.parentElement.querySelector("div.collection > div:first-child").getAttribute('data-id');
            //  newId;

            var newId = maxRequestId() + 1;
            gJson.collections.forEach(collection => {
                if (collection.collection.id === parseInt(itemId)) {
                    var newObject = { name: "New request", method: "GET", url: "", body: {}, id: newId };
                    // Додаємо новий об'єкт в кінець масиву
                    collection.collection.requests.push(newObject);
                    divReqGrp.appendChild(createRequestElement(newObject));
                }
            });
            saveToFile(gJson);
            divReqGrp.classList.remove("hide");
            if (divCollection.classList.contains("show-plus")) {
                divCollection.classList.toggle("show-plus");
                divCollection.classList.toggle("show-minus");
            }

            // alert("New request");
        });
        listAction.appendChild(listItemAction);
        listItemAction = document.createElement('li');
        listItemAction.classList.add("list-group-item", "border-0", "list-group-item-action");
        listItemAction.textContent = 'Run collection';
        listItemAction.addEventListener("click", (event) => {
            var activeActionMenu = listItemAction.parentElement.parentElement;
            activeActionMenu.classList.toggle("show-menu");
            activeActionMenu.classList.toggle("hide");

            const activeTab = document.querySelector(".nav-link.active");
            const activePane = document.querySelector(".tab-pane.active");
            const runTab = document.getElementById("run-tab");
            const runPane = document.getElementById("run-collection");
            if (!runTab.classList.contains("active")) {
                activeTab.classList.remove("active");
                activePane.classList.remove("active");
                runTab.classList.add("active");
                runPane.classList.add("active");
            }

            if (!runHeader.classList.contains("hide")) {
                runHeader.classList.add("hide");
                runSettings.classList.remove("hide");
            }
            var collectionItemId = event.target.parentElement.parentElement.parentElement.querySelector(".collection > div:first-child").getAttribute("data-id");
            var index = gJson.collections.findIndex(collection => collection.collection.id === parseInt(collectionItemId));
            btn_delFile.click();
            headerName.textContent = 'Run ' + gJson.collections[index].collection.name;
            sortList.innerHTML = '';
            divResults.classList.add("hide");
            inputResults.value = '';
            if (gJson.collections[index].collection.requests.length === 0) {
                runSettings.classList.add("hide");
                runHeader.classList.remove("hide");
                runHeader.textContent = 'Collection is empty.'
            }
            gJson.collections[index].collection.requests.forEach(request => {
                const liElement = document.createElement("li");
                liElement.classList.add("list-group-item", "border-0", "list-group-item-action");
                liElement.setAttribute("data-id", request.id);
                const inputElement = document.createElement("input");
                inputElement.classList.add("form-check-input", "me-1");
                inputElement.setAttribute("type", "checkbox");
                inputElement.checked = true;
                inputElement.addEventListener("change", () => {
                    const allUnchecked = Array.from(sortList.querySelectorAll("input")).every((checkbox) => !checkbox.checked
                    );

                    btn_Run.disabled = allUnchecked;
                })
                liElement.appendChild(inputElement);
                const spanElement = document.createElement("span");
                spanElement.classList.add("ms-1");
                spanElement.textContent = request.name;
                liElement.appendChild(spanElement);
                sortList.appendChild(liElement);
            });

            // console.log(gJson.collections[index]);
        });
        listAction.appendChild(listItemAction);
        listItemAction = document.createElement('li');
        listItemAction.classList.add("list-group-item", "border-0", "list-group-item-action");
        listItemAction.textContent = 'Rename';
        listItemAction.addEventListener("click", (event) => {
            var activeActionMenu = listItemAction.parentElement.parentElement;

            activeActionMenu.classList.toggle("show-menu");
            activeActionMenu.classList.toggle("hide");

            var collectionNameDiv = event.target.parentElement.parentElement.parentElement.querySelector("div.collection > div:first-child");
            originalCollectionName = collectionNameDiv.textContent;
            collectionNameDiv.parentElement.classList.toggle("collection-edit");
            // Встановлюємо contenteditable в true
            collectionNameDiv.contentEditable = true;



            // Встановлюємо фокус та переміщаємо курсор в кінець змісту
            var range = document.createRange();
            range.selectNodeContents(collectionNameDiv);
            range.collapse(false);

            var selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            // Виводимо фокус на елемент div
            collectionNameDiv.focus();
        });
        listAction.appendChild(listItemAction);
        listItemAction = document.createElement('li');
        listItemAction.classList.add("list-group-item", "border-0", "list-group-item-action");
        listItemAction.textContent = 'Delete';
        listItemAction.addEventListener("click", (event) => {
            var activeActionMenu = listItemAction.parentElement.parentElement;
            activeActionMenu.classList.toggle("show-menu");
            activeActionMenu.classList.toggle("hide");
            var result = confirm("Ви хочете видалити колекцію?");
            if (result) {
                collectionsList.removeChild(event.target.parentElement.parentElement.parentElement);
                var collectionId = event.target.parentElement.parentElement.parentElement.querySelector(".collection > div:first-child").getAttribute("data-id");

                var indexToDelete = gJson.collections.findIndex(collection => collection.collection.id === parseInt(collectionId));
                // Видаляємо об'єкт з масиву за його індексом
                if (indexToDelete !== -1) {
                    gJson.collections.splice(indexToDelete, 1);
                }
                saveToFile(gJson);
            } else {
                return;
            }

        });
        listAction.appendChild(listItemAction);
        divActionMenu.appendChild(listAction);
        listItem.appendChild(divActionMenu);
        const divReqGrp = document.createElement('div');
        divReqGrp.classList.add("list-group", "border-start", "hide");
        listItem.appendChild(divReqGrp);
        return listItem;

    }

    function createRequestElement(request) {

        const reqDivItemGrp = document.createElement('div');
        reqDivItemGrp.classList.add("request-item-group", "mt-0");
        const requestDiv = document.createElement('div');
        requestDiv.classList.add("list-group", "request", "list-group-horizontal");
        const requestButton = document.createElement('button');
        requestButton.classList.add("list-group-item", "list-group-item-action", "mt-0", "overflow-hidden");
        requestButton.textContent = `${request.name}`;

        requestButton.addEventListener('click', () => {
            const activeTab = document.querySelector(".nav-link.active");
            const activePane = document.querySelector(".tab-pane.active");
            const requestTab = document.getElementById("request-tab");
            const requestPane = document.getElementById("request");
            if (!requestTab.classList.contains("active")) {
                activeTab.classList.remove("active");
                activePane.classList.remove("active");
                requestTab.classList.add("active");
                requestPane.classList.add("active");
            }
            if (!requestButton.classList.contains('active') && !btn_Save.hasAttribute("disabled")) {
                var result = confirm("Ви маєте незбережені зміни, які будуть втрачені, якщо продовжити. Продовжити?");
                if (result) {
                    btn_Save.disabled = true;
                } else {
                    return;
                }
            }
            gResponse.value = '';
            errMessage.innerText = '';
            const allLinks = document.querySelectorAll('.list-group-item-action');

            // Перевірити наявність класу "active" і видалити його
            allLinks.forEach(link => {
                if (link.classList.contains('active')) {
                    link.classList.remove('active');
                }
            });
            requestButton.innerText = request.name;
            requestButton.classList.add("active");
            gJsonBody.value = `${JSON.stringify(request.body, null, 4)}`;
            gJsonBody.removeAttribute("disabled");
            gMethod.value = request.method;
            gMethod.removeAttribute("disabled");
            gUrl.value = request.url;
            gUrl.removeAttribute("disabled");
            gRequestName.innerHTML = request.name;
            btn_Send.removeAttribute("disabled");
            lnkBeauty.classList.remove("hide");
        });
        requestButton.setAttribute('data-id', request.id);
        requestDiv.appendChild(requestButton);
        const requestActionButton = document.createElement('button');
        requestActionButton.classList.add("dots", "list-group-item", "list-group-item-action", "hide");
        requestActionButton.textContent = '...';

        requestActionButton.addEventListener("click", (event) => {
            const activeActionMenu = document.querySelector(".show-menu");
            const currentActionMenu = reqDivItemGrp.querySelector(".action-div");
            if (activeActionMenu && activeActionMenu !== currentActionMenu) {
                activeActionMenu.classList.toggle("show-menu");
                activeActionMenu.classList.toggle("hide");
            }
            currentActionMenu.classList.toggle("hide");
            currentActionMenu.classList.toggle("show-menu");
            event.stopPropagation();
        });

        requestDiv.appendChild(requestActionButton);
        requestDiv.addEventListener("mouseover", () => {
            requestDiv.querySelector(".dots").classList.remove("hide");
        });
        requestDiv.addEventListener("mouseleave", () => {
            requestDiv.querySelector(".dots").classList.add("hide");
        });
        reqDivItemGrp.appendChild(requestDiv)

        const reqDivAction = document.createElement('div');
        reqDivAction.classList.add("action-div", "hide");
        const reqListAction = document.createElement('ul');
        reqListAction.classList.add("action-collection", "border", "rounded", "list-group");
        var listItemReqAction = document.createElement('li');
        listItemReqAction.classList.add("list-group-item", "border-0", "list-group-item-action");
        listItemReqAction.textContent = 'Duplicate';
        listItemReqAction.addEventListener("click", (event) => {
            var activeActionMenu = listItemReqAction.parentElement.parentElement;
            activeActionMenu.classList.toggle("show-menu");
            activeActionMenu.classList.toggle("hide");
            var grpRequests = event.target.parentElement.parentElement.parentElement.parentElement;
            var itemCollectionId = grpRequests.parentElement.querySelector(".collection > div:first-child").getAttribute("data-id");
            var itemRequestId = event.target.parentElement.parentElement.parentElement.querySelector(".request > button:first-child").getAttribute("data-id");
            gJson.collections.forEach(collection => {
                if (collection.collection.id === parseInt(itemCollectionId)) {
                    collection.collection.requests.forEach(request => {
                        if (request.id === parseInt(itemRequestId)) {
                            var newObject = { name: request.name + ' copy', method: request.method, url: request.url, body: request.body, id: maxRequestId() + 1 };
                            collection.collection.requests.push(newObject);
                            grpRequests.appendChild(createRequestElement(newObject));
                        }
                    })

                }
            });
            saveToFile(gJson);
        });
        reqListAction.appendChild(listItemReqAction);
        listItemReqAction = document.createElement('li');
        listItemReqAction.classList.add("list-group-item", "border-0", "list-group-item-action");
        listItemReqAction.textContent = 'Delete';
        listItemReqAction.addEventListener("click", (event) => {
            // alert("Delete!");
            var activeActionMenu = listItemReqAction.parentElement.parentElement;
            activeActionMenu.classList.toggle("show-menu");
            activeActionMenu.classList.toggle("hide");
            var result = confirm("Ви хочете видалити request?");
            if (result) {
                var grpRequests = event.target.parentElement.parentElement.parentElement.parentElement;
                var requestForDel = event.target.parentElement.parentElement.parentElement;
                var itemId = requestForDel.querySelector("button:first-child").getAttribute("data-id");
                gJson.collections.forEach(collection => {
                    var indexToDelete = collection.collection.requests.findIndex(request => request.id === parseInt(itemId));
                    // Видаляємо об'єкт з масиву за його індексом
                    if (indexToDelete !== -1) {
                        collection.collection.requests.splice(indexToDelete, 1);
                    }
                });
                if (requestForDel.querySelector(".active")) {
                    gJsonBody.value = '';
                    gJsonBody.disabled = true;
                    gResponse.value = '';
                    gMethod.value = "GET";
                    gMethod.disabled = true;
                    gUrl.value = "";
                    gUrl.disabled = true;
                    gRequestName.innerHTML = '';
                    btn_Send.disabled = true;
                    lnkBeauty.classList.add("hide");
                }
                grpRequests.removeChild(requestForDel);
                saveToFile(gJson);
            } else {
                return;
            }

        });
        reqListAction.appendChild(listItemReqAction);
        reqDivAction.appendChild(reqListAction);
        reqDivItemGrp.appendChild(reqDivAction);
        return reqDivItemGrp;
        // divReqGrp.appendChild(reqDivItemGrp);

        // requestItem.setAttribute('data-id', request.id);


        // divReqGrp.appendChild(requestDiv);

    }
    function fillCollections(jsonData) {
        if (!jsonData.collections) 
            return
        jsonData = addId(jsonData);
        gJson = jsonData;
        jsonData.collections.forEach(collection => {
            const requests = collection.collection.requests;
            var collectionItem = createCollectionElement(collection.collection.name, collection.collection.id);

            const divReqGrp = collectionItem.querySelector("div:last-child");
            requests.forEach(request => {
                var reqDivItemGrp = createRequestElement(request);
                divReqGrp.appendChild(reqDivItemGrp);
            });
            collectionsList.appendChild(collectionItem);
        });
    }
    fetch('/load', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(response => response.json())
        .then(data => {
            fillCollections(data);
        });
    this.document.addEventListener("click", (event) => {
        var actionDiv = this.document.querySelector(".show-menu");
        if (actionDiv && !actionDiv.contains(event.target)) {
            actionDiv.classList.toggle("hide");
            actionDiv.classList.toggle("show-menu");
        }
    })

    btn_Send.addEventListener("click", makeRequest);
    lnkBeauty.addEventListener("click", () => {
        errMessage.innerText = "";
        var jsonOldValue = gJsonBody.value;
        try {
            gJsonBody.value = `${JSON.stringify(JSON.parse(gJsonBody.value), null, 4)}`;
        } catch (error) {
            errMessage.innerText = "Invalid JSON: " + error.message;
            throw new Error("JSON invalid");
        }
        if (jsonOldValue !== gJsonBody.value) {
            // Створюємо та ініціалізуємо подію input
            var inputEvent = new Event('input', {
                bubbles: true,
                cancelable: true,
            });
            // Викликаємо подію input для поля textarea
            gJsonBody.dispatchEvent(inputEvent);
        }

    });

    gRequestName.addEventListener("mousedown", () => {
        if (!gRequestName.isContentEditable) {
            gRequestName.setAttribute("contenteditable", "true");
        }
    })
    gRequestName.addEventListener("input", () => {
        document.querySelector("button.active").innerText = gRequestName.innerText;
        btn_Save.removeAttribute("disabled");
    })
    gRequestName.addEventListener("blur", () => {
        if (gRequestName.isContentEditable) {
            gRequestName.setAttribute("contenteditable", "false");
        }
    })
    gRequestName.addEventListener('keydown', function (event) {
        // Перевірити, чи натискана клавіша Enter (код 13)
        if (event.key === 'Enter') {
            // Заборонити дію за замовчуванням (не перевіряти це, якщо ви хочете залишити Enter)
            event.preventDefault();
            // Розфокусувати елемент
            this.blur();
        }
    });
    // Заборонити подію dragstart для елемента
    gRequestName.addEventListener('dragstart', function (event) {
        event.preventDefault();
    });
    gMethod.addEventListener("change", () => {
        if (btn_Save.hasAttribute("disabled")) {
            btn_Save.removeAttribute("disabled");
        }

    });
    gUrl.addEventListener("input", () => {
        if (btn_Save.hasAttribute("disabled")) {
            btn_Save.removeAttribute("disabled");
        }
    });
    gJsonBody.addEventListener("input", () => {
        if (btn_Save.hasAttribute("disabled")) {
            btn_Save.removeAttribute("disabled");
        }
    });
    btn_Save.addEventListener("click", () => {
        errMessage.innerText = "";
        const linkActive = this.document.querySelector("button.active");
        const itemId = linkActive.getAttribute('data-id');
        gJson.collections.forEach(collection => {
            collection.collection.requests.forEach(request => {
                if (request.id === parseInt(itemId)) {
                    request.method = gMethod.value;
                    request.url = gUrl.value;
                    request.name = gRequestName.innerText;
                    try {
                        request.body = JSON.parse(gJsonBody.value);
                    } catch (error) {
                        errMessage.innerText = "Invalid JSON: " + error.message;
                        throw new Error("JSON invalid");
                    }
                }
            })
        });
        saveToFile(gJson);
    })
    btnNewCollection.addEventListener("click", () => {
        var collectionItem = createCollectionElement("New collection", maxCollectiontId() + 1);
        collectionsList.appendChild(collectionItem);
        var newObject = { collection: { name: "New collection", requests: [], id: maxCollectiontId() + 1 } };
        gJson.collections.push(newObject);
        saveToFile(gJson);
    })
    var sortableList = new Sortable(document.getElementById('sortable-list'), {
        animation: 150, // час анімації при перетягуванні
        ghostClass: 'sortable-ghost', // клас для виділення перетягуваного елемента
        chosenClass: 'sortable-chosen', // клас для виділення обраного елемента
        dragClass: 'sortable-drag' // клас для виділення перетягуваного елемента під час перетягування
    });
    const btnCloseRunner = this.document.getElementById("btn-close-runner");
    btnCloseRunner.addEventListener("click", () => {
        runHeader.classList.remove("hide");
        runSettings.classList.add("hide");
        headerName.textContent = 'Run collection';
    })

    btn_Run.addEventListener("click", () => {
        if (btn_Run.textContent === 'Run') {
            connect();
            btn_Run.disabled = true;
            inputResults.value = '';
            const intervalId = setInterval(() => {
                if (stompClient.connected) {
                    clearInterval(intervalId);
                    var jsonObject = runConfiguration();
                    sendArray(JSON.stringify(jsonObject));
                    btn_Run.textContent = 'Stop';
                    btn_Run.disabled = false;
                    divResults.classList.remove("hide");
                }
            }, 10);
        } else {
            stompClient.publish({
                destination: "/app/stop-executing"
            });
            btn_Run.textContent = 'Stopping...';
            btn_Run.disabled = true;
        }

    })

    function runConfiguration() {
        var newObj = {};
        newObj.requests = [];
        // console.dir(sortList.children[0].querySelector(":first-child").checked);
        sortList.childNodes.forEach(child => {
            if (child.querySelector(":first-child").checked) {
                gJson.collections.forEach(collection => {
                    var indexRequest = collection.collection.requests.findIndex(request => request.id === parseInt(child.getAttribute("data-id")))
                    // Видаляємо об'єкт з масиву за його індексом
                    if (indexRequest !== -1) {
                        newObj.requests.push(collection.collection.requests[indexRequest]);
                    }
                })
            };
        })
        newObj.delay = parseInt(document.getElementById("delay").value);
        newObj.numThreads = parseInt(num_Threads.value);
        newObj.iterations = gVars;
        console.log(newObj);
        return newObj;
    }
    function readFile() {

        // Перевірити, чи вибрано файл
        if (fileVars.files.length > 0) {
            // Отримати перший вибраний файл
            var file = fileVars.files[0];

            // Створити об'єкт FileReader
            var reader = new FileReader();

            // Обробник події при завершенні читання файлу
            reader.onload = function (e) {
                // Отримати зміст файлу
                gfileContents = e.target.result;
                iterationsDiv.classList.remove("hide");
                glines = gfileContents.split('\r\n');
                // iterationsInput.value = glines.length - 1;
                var kol_vars = glines[0].split(",").length;
                var cntIterations = 0;
                glines.forEach(str => {
                    if (str) {
                        cntIterations += 1;
                        var vars = str.split(",");
                        if (vars.length !== kol_vars) {
                            errFile.innerText = "Wrong count of variables in the file!";
                            throw new Error("Wrong count of variables in the file!");
                        }
                        gVars.push(vars);    
                    }
                })
                iterationsInput.value = cntIterations - 1;
                if (iterationsInput.value > 1) {
                    num_Threads.disabled = false;
                    num_Threads.setAttribute("max", iterationsInput.value)
                }
                btn_Run.disabled = false;
            };
            // Прочитати файл як текст
            reader.readAsText(file);
        }
    }
    fileVars.addEventListener("change", () => {
        errFile.innerText = "";
        glines = null;
        gfileContents = null;
        gVars = [];
        if (fileVars.files.length > 0) {
            btn_delFile.classList.remove("hide");
            btn_Run.disabled = true;
            readFile();
        } else {
            btn_delFile.classList.add("hide");
            iterationsDiv.classList.add("hide");
            fileVars.value = '';

            num_Threads.disabled = true;
            num_Threads.value = 1;
            btn_Run.disabled = false;
        }
    })
    btn_delFile.addEventListener("click", () => {
        fileVars.value = '';
        btn_delFile.classList.add("hide");
        iterationsDiv.classList.add("hide");
        glines = null;
        gfileContents = null;
        gVars = [];
        errFile.innerText = "";
        num_Threads.disabled = true;
        num_Threads.value = 1;
        btn_Run.disabled = false;
    })
    btn_Preview.addEventListener("click", () => {
        this.document.querySelector(".modal-body").innerText = gfileContents;
    })
});