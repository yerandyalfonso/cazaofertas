"""
Intenta crear la máquina gratis de Oracle Cloud en Madrid (proxy de Amazon con
IP española). La capa «Always Free» suele estar sin capacidad: se ejecuta cada
5 min (timer oracle-proxy-launch en el VPS) hasta conseguirla y avisa por
Telegram al chat del admin. Si ya existe la instancia, no hace nada.

Requisitos: ~/.oci/config + clave API; venv con `oci`; .env.local con
TELEGRAM_BOT_TOKEN y TELEGRAM_ADMIN_CHAT_ID. Clave SSH pública en
~/.oci/oracle_madrid_ed25519.pub.
"""
import json, os, sys, urllib.parse, urllib.request
from pathlib import Path
import oci

NAME = "proxy-amazon"
SHAPES = [("VM.Standard.A1.Flex", {"ocpus": 1, "memory_in_gbs": 6}), ("VM.Standard.E2.1.Micro", None)]

def env(key: str) -> str | None:
    for line in Path(os.environ.get("ENV_FILE", ".env.local")).read_text().splitlines():
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1].strip().strip('"')
    return None

def telegram(text: str) -> None:
    token, chat = env("TELEGRAM_BOT_TOKEN"), env("TELEGRAM_ADMIN_CHAT_ID")
    if not token or not chat:
        return
    data = urllib.parse.urlencode({"chat_id": chat, "text": text}).encode()
    urllib.request.urlopen(f"https://api.telegram.org/bot{token}/sendMessage", data, timeout=20)

cfg = oci.config.from_file()
tid = cfg["tenancy"]
compute, net = oci.core.ComputeClient(cfg), oci.core.VirtualNetworkClient(cfg)
idn = oci.identity.IdentityClient(cfg)

live = [i for i in compute.list_instances(tid).data if i.display_name == NAME and i.lifecycle_state not in ("TERMINATED", "TERMINATING")]
if live:
    print(f"Ya existe {NAME} ({live[0].lifecycle_state}); nada que hacer.")
    sys.exit(0)

ad = idn.list_availability_domains(tid).data[0].name
subnet = next(s for s in net.list_subnets(tid).data if s.display_name == "subred-publica")
ssh_key = Path("~/.oci/oracle_madrid_ed25519.pub").expanduser().read_text().strip()

for shape, shape_cfg in SHAPES:
    image = next(
        i for i in compute.list_images(tid, operating_system="Canonical Ubuntu", operating_system_version="24.04",
                                       shape=shape, sort_by="TIMECREATED", sort_order="DESC").data
        if "Minimal" not in i.display_name
    )
    details = oci.core.models.LaunchInstanceDetails(
        compartment_id=tid, availability_domain=ad, display_name=NAME, shape=shape,
        shape_config=oci.core.models.LaunchInstanceShapeConfigDetails(**shape_cfg) if shape_cfg else None,
        source_details=oci.core.models.InstanceSourceViaImageDetails(image_id=image.id),
        create_vnic_details=oci.core.models.CreateVnicDetails(subnet_id=subnet.id, assign_public_ip=True),
        metadata={"ssh_authorized_keys": ssh_key},
    )
    try:
        inst = compute.launch_instance(details).data
    except oci.exceptions.ServiceError as error:
        print(f"{shape}: {error.code} {error.message[:90]}")
        continue
    inst = oci.wait_until(compute, compute.get_instance(inst.id), "lifecycle_state", "RUNNING", max_wait_seconds=600).data
    vnic_id = compute.list_vnic_attachments(tid, instance_id=inst.id).data[0].vnic_id
    ip = net.get_vnic(vnic_id).data.public_ip
    msg = f"✅ Oracle Madrid: máquina gratis creada ({shape}). IP pública: {ip}"
    print(msg)
    telegram(msg)
    sys.exit(0)

print("Sin capacidad en ninguna forma gratis; se reintentará.")
