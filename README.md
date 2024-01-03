## DIRIGERA Adaptive Lighting Service
Install npm dependencies 
```bash
npm install
```

Update the WorkingDirectory value in the dirigera-adaptive-lighting.service systemd unit file to match the location of your cloned repo.

Copy the systemd unit file to the system 
```bash
sudo cp dirigera-adaptive-lighting.service /lib/systemd/system
```

Enable the systemd unit
```bash
sudo systemctl enable --now dirigera-adaptive-lighting
```
