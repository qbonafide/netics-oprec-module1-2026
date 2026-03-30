# Laporan Penugasan Modul 1 OPREC NETICS 2026


| Key | Value |
|-----|-------|
| Nama | Christina Tan |
| NRP | 5025241060 |
| Link Docs Penugasan | [https://docs.google.com/document/d/11yzgwByWrnmcZ4dQC1MYS_dq12UrjpYHqdl0XIi9gVY/edit?usp=sharing](https://docs.google.com/document/d/11yzgwByWrnmcZ4dQC1MYS_dq12UrjpYHqdl0XIi9gVY/edit?usp=sharing) |
| Link Docker Image | [https://hub.docker.com/repository/docker/qbonafide/modul1-netics/](https://hub.docker.com/repository/docker/qbonafide/modul1-netics/) |
| Link URL API | [http://20.44.230.54/health](http://20.44.230.54/health) |

<br>

## Overview
Penugasan 1 Oprec NETICS 2026 mengimplementasikan pipeline CI/CD sederhana untuk membangun API publik dengan endpoint `/health`. Tools yang dipakai meliputi Docker, Ansible, Github Actions, dan VPS Azure. Ansible digunakan untuk mengotomatisasi instalasi dan konfigurasi nginx sebagai reverse proxy pada VPS. Github Actions mengotomatisasi proses build docker image, menjalankan playbook ansible, dan melakukan deployment pada VPS dan menjalankannya.

<br>

## Penjelasan Kode
### `index.js`

```js
import express from 'express';
const app = express();
const port = 3000;

function format(seconds){
  function pad(s){
    return (s < 10 ? '0' : '') + s;
  }
  var hours = Math.floor(seconds / (60*60));
  var minutes = Math.floor(seconds % (60*60) / 60);
  var seconds = Math.floor(seconds % 60);

  return pad(hours) + ':' + pad(minutes) + ':' + pad(seconds);
}

app.get('/health', (req, res) => {
    res.json({
        "nama": "Christina Tan",
        "nrp": "5025241060",
        "status": "UP",
        "timestamp": new Date().toISOString(),
        "uptime": format(process.uptime())
    })
})

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})
```

Kode ini dibangun menggunakan bahasa JavaScipt dengan runtime Node.js dan framework Express.js untuk membangun endpoint `/health` yang menampilkan informasi seperti nama, nrp, status, timestamp, dan uptime. Port yang digunakan adalah port 3000. Uptime dihitung menggunakan `process.uptime()` dan diformat ke dalam bentuk `HH:MM:SS` menggunakan fungsi format. Implementasi fungsi ini berasal dari referensi [berikut](https://stackoverflow.com/questions/28705009/how-do-i-get-the-server-uptime-in-node-js).

<br>

## Penjelasan Dockerfile
### `Dockerfile`

```
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

Dockerfile ini menggunakan base image `node:20-alpine` yang berbasis alpine linux yang memiliki ukuran lightweight dibanding image lainnya. Working directory diatur ke dalam `/app`, kemudian file `package.json` dan `package-lock.json` dicopy ke dalam docker dan kemudian dijalankan `npm ci --omit=dev` untuk menginstall depedencies yang diperlukan untuk menjalankan app. `--omit=dev` digunakan agar hanya dependencies yang dibutuhkan untuk menjalankan aplikasi yang diinstall, tanpa menyertakan `devDependencies`, sehingga image menjadi lebih kecil dan lebih optimal untuk production. File sisanya dicopy ke dalam container dan membuka port 3000 agar API bisa berjalan di port tersebut. `CMD ["npm", "start"]` adalah command default yang bakal dijalankan saat app dimulai. Referensi code Dockerfile berasal dari [sini](https://www.hostinger.com/tutorials/how-to-use-node-js-with-docker?utm_source=google&utm_medium=cpc&utm_id=23198985495&utm_campaign={campaignname}&utm_term=&utm_content={searchterm}&gad_source=1&gad_campaignid=23198985495&gclid=Cj0KCQjwmunNBhDbARIsAOndKplBwici23jfc42kJcNtJxdhztsadCUTkU6Hw77Mr-iGjLMKlknro14aAjJZEALw_wcB).

<br>

## Penjelasan Ansible
### 1. Config `reverse_proxy.conf`

```
server {
    listen 80;
    server_name _;

    location /health {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Konfigurasi ini digunakan untuk mengatur Nginx sebagai reverse proxy. Nginx akan menerima request dari user, kemudian meneruskannya ke backend API yang berjalan di dalam container. `listen 80` digunakan agar Nginx mendengarkan request pada port 80 (HTTP). `server_name _;` digunakan sebagai wildcard agar server menerima request dari semua domain/IP. Pada bagian `location /health`, setiap request yang menuju endpoint `/health` akan diteruskan ke backend API yang berjalan di `http://127.0.0.1:3000`. `proxy_set_header Host $host;` digunakan untuk memberi tahu backend user mengakses domain apa. `proxy_set_header X-Real-IP $remote_addr;` untuk memberi tahu backend IP asli user. `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` digunakan untuk menyimpan chain IP user melalui proxy. Referensi konfigurasi reverse proxy berasal dari [sini](https://github.com/arsitektur-jaringan-komputer/Modul-Jarkom/tree/master/Modul-3/Reverse%20Proxy#224-konfigurasi-reverse-proxy)

### 2. `inventory.ini`

```
[webservers]
20.44.230.54 ansible_user=azureuser
```

`inventory.ini` digunakan oleh Ansible untuk mendefinsikan host yang akan dikelola. Di konfigurasi ini, saya mendefinisikan grup `webservers` yang berisi IP VPS saya. `ansible_user=azureuser` digunakan buat menentukan user yang akan dipakai ansible saat melakukan SSH ke VPS nanti.

### 3. `playbook.yml`

```
---
- name: Install and configure nginx reverse proxy
  hosts: webservers
  become: yes

  tasks:
    - name: Install nginx
      apt:
        name: nginx
        state: latest
        update_cache: yes

    - name: Remove default nginx configuration
      file:
        path: /etc/nginx/sites-enabled/default
        state: absent

    - name: Add nginx configuration
      copy:
        src: conf/reverse_proxy.conf
        dest: /etc/nginx/sites-available/reverse_proxy.conf
        owner: root
        group: root
        mode: '0644'

    - name: Enable website configuration
      file:
        src: /etc/nginx/sites-available/reverse_proxy.conf
        dest: /etc/nginx/sites-enabled/reverse_proxy.conf
        state: link

    - name: Test nginx configuration
      command: nginx -t
      changed_when: false

    - name: Restart nginx
      service:
        name: nginx
        state: restarted
        enabled: yes
```

`playbook.yml` digunakan untuk mengotomatisasi konfigurasi server menggunakan Ansible. Playbook ini akan dijalankan pada host yang terdaftar dalam grup `webservers`, dengan `become: yes` untuk menjalankan tasks dengan hak akses sebagai root.


Playbook ini berisi daftar tasks yang mendefinisikan state yang diinginkan pada server, yaitu:
- Menginstall nginx
- Menghapus konfigurasi default nginx
- Menambahkan konfigurasi reverse proxy dari file `reverse_proxy.conf`
- Mengaktifkan konfigurasi dengan membuat symbolic link ke `sites-enabled`
- Mengetes konfigurasi nginx menggunakan `nginx -t`
- Restart nginx

Untuk referensi `playbook.yml` yang digunakan berasal dari [sini](https://dev.to/dpuig/creating-an-ansible-playbook-to-install-and-configure-nginx-for-hosting-static-websites-3n6j)

<br>

## Penjelasan Github Actions
### `deploy.yaml`

```
name: Build Public API with CI/CD

on:
  push:
    branches:
      - main

jobs:
  build-and-test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: ./src/package-lock.json

      - run: npm ci
        working-directory: ./src
      - run: npm test
        working-directory: ./src

  build-and-push-image:
    runs-on: ubuntu-latest
    needs: build-and-test

    steps:
      - uses: actions/checkout@v4

      - uses: docker/login-action@v4
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_TOKEN }}

      - uses: docker/setup-buildx-action@v4

      - uses: docker/build-push-action@v7
        with:
          context: ./src
          push: true
          tags: ${{ secrets.DOCKER_USERNAME }}/modul1-netics:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  configure-nginx-on-vps:
    runs-on: ubuntu-latest
    needs: build-and-push-image

    steps:
      - uses: actions/checkout@v4

      - uses: dawidd6/action-ansible-playbook@v2
        with:
          playbook: playbook.yml
          directory: ./src/ansible
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          known_hosts: |
            20.44.230.54 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINfhPmnwXNvIRHsRVSOpKAIb1wfWChLeZlHYRxHUsZAu
          options: |
            -i inventory.ini
            -vv

  deploy-container-on-vps:
    runs-on: ubuntu-latest
    needs: configure-nginx-on-vps

    steps:
      - uses: appleboy/ssh-action@v1.0.3
        with:
          host: 20.44.230.54
          username: azureuser
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            sudo docker pull ${{ secrets.DOCKER_USERNAME }}/modul1-netics:latest
            sudo docker stop modul1-netics || true
            sudo docker rm modul1-netics || true
            sudo docker run -d --name modul1-netics -p 3000:3000 ${{ secrets.DOCKER_USERNAME }}/modul1-netics:latest
            sleep 5
            curl --fail http://localhost:3000/health
            curl --fail http://20.44.230.54/health
```

Github actions digunakan untuk otomatisasi proses build dan deploy web/aplikasi. `on: push: branches: - main` menjalankan workflow setiap ada push ke branch main. Workflow ini terdiri dari beberapa jobs yang saling bergantung (job selanjutnya dijalankan setelah menjalankan job sebelumnya) yaitu: 
1. **build-and-test**, untuk menginstall depedencies dan menjalankan proses testing. Referensi code berasal dari [sini](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs).
2. **build-and-push-image**, untuk build docker image dan push ke docker hub menggunakan credentials yang disimpan di github secrets. Referensi code berasal dari [sini](https://github.com/marketplace/actions/build-and-push-docker-images).
3. **configure-nginx-on-vps**, untuk menjalankan playbook ansible yang telah dibuat sebelumnya, menggunakan `SSH_PRIVATE_KEY` yang didapat dari dari VPS. Referensi code berasal dari [sini](https://github.com/dawidd6/action-ansible-playbook).
4. **deploy-container-on-vps**, untuk pull docker image terbaru dari docker hub, stop container lama jika ada, lalu menjalankan container baru, dan mengecek endpoint `/health` dengan curl. Referensi code berasal dari [sini](https://github.com/appleboy/ssh-action).

Pipeline ini mengimplementasikan proses CI/CD secara otomatis mulai dari build, testing, containerization, hingga deployment ke server.

<br>

## Best Practices
1. Menggunakan needs agar jobs berjalan secara berurutan.
2. Memecah workflow menjadi beberapa job kecil agar setiap job lebih terfokus dan gampang didebug.
3. Menggunakan github actions marketplace melalui `uses` untuk memanfaatkan workflow yang udah tersedia.
4. Tidak menghardcode data sensitif, melainkan menggunakan github secrets untuk menyimpan data seperti docker credentials dan SSH private key.
5. Menggunakan caching pada github actions (`cache: npm`, `cache-from`, `cache-to`) untuk mempercepat proses build.
6. Menggunakan reverse proxy agar backend API tidak terekspos secara langsung ke public
7. Melakukan health check setelah deployment menggunakan `curl` untuk memastikan sudah berjalan.

Beberapa referensi best practices berasal dari [sini](https://github.com/github/awesome-copilot/blob/main/instructions/github-actions-ci-cd-best-practices.instructions.md)

<br>

## Kesimpulan
Menggunakan CI/CD pipeline dengan github actions membuat proses testing, build, dan deployment lebih praktis dan otomatis dijalankan saat terjadi perubahan pada branch main. Ansible juga digunakan untuk otomatisasi proses instalasi dan konfigurasi nginx dan reverse proxy pada VPS. Penggunaan Docker juga membantu dalam menjaga konsistensi environment sehingga bisa dijalankan dengan stabil di berbagai environment.

<br>

## Dokumentasi
### Endpoint /health pada API
![](/media/1.png)

### Docker Hub
![](/media/2.png)

### Github Actions
![](/media/3.png)
![](/media/4.png)
![](/media/5.png)
![](/media/6.png)
![](/media/7.png)

## Referensi / Credits
1. [https://stackoverflow.com/questions/28705009/how-do-i-get-the-server-uptime-in-node-js](https://stackoverflow.com/questions/28705009/how-do-i-get-the-server-uptime-in-node-js)
2. [https://www.hostinger.com/tutorials/how-to-use-node-js-with-docker?utm_source=google&utm_medium=cpc&utm_id=23198985495&utm_campaign={campaignname}&utm_term=&utm_content={searchterm}&gad_source=1&gad_campaignid=23198985495&gclid=Cj0KCQjwmunNBhDbARIsAOndKplBwici23jfc42kJcNtJxdhztsadCUTkU6Hw77Mr-iGjLMKlknro14aAjJZEALw_wcB](https://www.hostinger.com/tutorials/how-to-use-node-js-with-docker?utm_source=google&utm_medium=cpc&utm_id=23198985495&utm_campaign={campaignname}&utm_term=&utm_content={searchterm}&gad_source=1&gad_campaignid=23198985495&gclid=Cj0KCQjwmunNBhDbARIsAOndKplBwici23jfc42kJcNtJxdhztsadCUTkU6Hw77Mr-iGjLMKlknro14aAjJZEALw_wcB)
3. [https://github.com/arsitektur-jaringan-komputer/Modul-Jarkom/tree/master/Modul-3/Reverse%20Proxy#224-konfigurasi-reverse-proxy](https://github.com/arsitektur-jaringan-komputer/Modul-Jarkom/tree/master/Modul-3/Reverse%20Proxy#224-konfigurasi-reverse-proxy)
4. [https://dev.to/dpuig/creating-an-ansible-playbook-to-install-and-configure-nginx-for-hosting-static-websites-3n6j](https://dev.to/dpuig/creating-an-ansible-playbook-to-install-and-configure-nginx-for-hosting-static-websites-3n6j)
5. [https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs)
6. [https://github.com/marketplace/actions/build-and-push-docker-images](https://github.com/marketplace/actions/build-and-push-docker-images)
7. [https://github.com/dawidd6/action-ansible-playbook](https://github.com/dawidd6/action-ansible-playbook)
8. [https://github.com/appleboy/ssh-action](https://github.com/appleboy/ssh-action)
9. [https://github.com/github/awesome-copilot/blob/main/instructions/github-actions-ci-cd-best-practices.instructions.md](https://github.com/github/awesome-copilot/blob/main/instructions/github-actions-ci-cd-best-practices.instructions.md)
10. [https://github.com/eligeraldine/modul-1-oprec-netics-2025](https://github.com/eligeraldine/modul-1-oprec-netics-2025)
11. [https://github.com/spuuntries/netics-assignment-1](https://github.com/spuuntries/netics-assignment-1)

<br>

## ChatGPT Reference
Screenshot penggunaan ChatGPT dalam mengerjakan tugas:

![](/media/c1.png)

![](/media/c2.png)

![](/media/c3.png)

![](/media/c4.png)

![](/media/c5.png)

![](/media/c6.png)
