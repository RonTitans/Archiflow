from setuptools import setup, find_packages

setup(
    name='netbox-archiflow',
    version='0.1.0',
    description='ArchiFlow network diagram integration for NetBox',
    author='ArchiFlow Team',
    packages=find_packages(),
    include_package_data=True,
    package_data={
        'netbox_archiflow': [
            'templates/netbox_archiflow/*.html',
        ],
    },
    install_requires=[],
    zip_safe=False,
)