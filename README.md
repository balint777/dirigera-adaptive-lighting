# b22 home automation scripts

## DIRIGERA Adaptive Lighting Service
Install npm dependencies 
```bash
npm install
```

Copy the systemd unit file to the system 
```bash
sudo cp dirigera-adaptive-lighting.service /lib/systemd/system
```

Enable the systemd unit
```bash
sudo systemctl enable --now dirigera-adaptive-lighting
```
